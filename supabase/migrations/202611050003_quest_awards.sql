create or replace function app_private.schedule_due(p_spec jsonb, p_date date) returns boolean
language plpgsql immutable set search_path = '' as $$
declare v_kind text := p_spec->>'kind'; v_weekday integer;
begin
 case v_kind
 when 'DAILY' then return true;
 when 'WEEKDAYS' then
  v_weekday := extract(isodow from p_date)::integer;
  return p_spec->'weekdays' @> to_jsonb(array[v_weekday]);
 when 'MONTHLY' then
  return extract(day from p_date)::integer=least((p_spec->>'day')::integer,
   extract(day from (date_trunc('month',p_date)::date+interval '1 month - 1 day'))::integer);
 when 'YEARLY' then
  return extract(month from p_date)::integer=(p_spec->>'month')::integer and
   extract(day from p_date)::integer=least((p_spec->>'day')::integer,
    extract(day from (make_date(extract(year from p_date)::integer,(p_spec->>'month')::integer,1)+interval '1 month - 1 day'))::integer);
 when 'ONCE' then return p_date=(p_spec->>'date')::date;
 else raise exception 'INVALID_SCHEDULE' using errcode='22023';
 end case;
end $$;
revoke all on function app_private.schedule_due(jsonb,date) from public,anon,authenticated;

create or replace function public.record_quest(
 p_quest_id uuid, p_scheduled_date date, p_outcome_id uuid default null, p_activity_date date default null
) returns public.quest_occurrences
language plpgsql security definer set search_path = '' as $$
declare
 v_owner uuid := auth.uid(); v_quest public.quest_definitions%rowtype;
 v_period public.quest_schedule_periods%rowtype; v_existing public.quest_occurrences%rowtype;
 v_saved public.quest_occurrences%rowtype; v_effects jsonb; v_snapshot jsonb; v_outcome_label text;
 v_today date; v_active boolean; v_streak public.streak_states%rowtype;
 v_length integer := 1; v_bonus jsonb := '{}'::jsonb; v_key text;
 v_last_due date; v_activity date; v_calendar_today date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_scheduled_date is null then raise exception 'INVALID_DATE' using errcode='22023'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 perform app_private.reconcile_owner(v_owner);
 select * into v_quest from public.quest_definitions where id=p_quest_id and owner_user_id=v_owner for update;
 if not found then raise exception 'QUEST_NOT_FOUND' using errcode='22023'; end if;
 select * into v_existing from public.quest_occurrences
  where owner_user_id=v_owner and quest_id=p_quest_id and scheduled_date=p_scheduled_date for update;
 if found then
  if v_existing.status='completed' and v_existing.selected_outcome_id is not distinct from p_outcome_id
    and v_existing.actual_activity_date is not distinct from coalesce(p_activity_date,p_scheduled_date) then return v_existing; end if;
  if v_existing.status not in ('unreported','partial') then raise exception 'STALE_QUEST_OCCURRENCE' using errcode='40001'; end if;
  if v_existing.status='partial' and v_quest.type<>'routine' then raise exception 'STALE_QUEST_OCCURRENCE' using errcode='40001'; end if;
 end if;
 select * into v_period from public.quest_schedule_periods
  where owner_user_id=v_owner and quest_id=p_quest_id and active_from<=p_scheduled_date
   and (active_through is null or active_through>=p_scheduled_date)
  order by generation desc limit 1;
 if not found or app_private.schedule_due(v_period.schedule_spec,p_scheduled_date) is not true then
  raise exception 'QUEST_NOT_DUE' using errcode='22023';
 end if;
 select (timezone(time_zone,now())-interval '3 hours')::date,timezone(time_zone,now())::date
 into v_today,v_calendar_today from public.profiles where user_id=v_owner;
 v_activity:=coalesce(p_activity_date,p_scheduled_date);
 if v_quest.state<>'active' and p_scheduled_date>=v_today then raise exception 'QUEST_NOT_ACTIVE' using errcode='22023'; end if;
 if p_scheduled_date>v_today or v_activity>v_calendar_today then raise exception 'FUTURE_OCCURRENCE' using errcode='22023'; end if;
 if v_quest.type='routine' and (v_existing.id is null or
   (select count(*) from public.routine_step_completions where occurrence_id=v_existing.id and completed_at is not null)<>
   (select count(*) from public.routine_steps where quest_id=p_quest_id)) then
  raise exception 'ROUTINE_REQUIRES_STEPS' using errcode='22023'; end if;
 if v_quest.type='volatile' then
  if p_outcome_id is null then raise exception 'OUTCOME_REQUIRED' using errcode='22023'; end if;
  select effects,label into v_effects,v_outcome_label from public.quest_outcomes
   where id=p_outcome_id and quest_id=p_quest_id and owner_user_id=v_owner;
  if not found then raise exception 'OUTCOME_NOT_FOUND' using errcode='22023'; end if;
 else
  if p_outcome_id is not null then raise exception 'UNEXPECTED_OUTCOME' using errcode='22023'; end if;
  v_effects := v_quest.effects;
 end if;
 -- A past entry may be corrected later but cannot restore or advance a live streak.
 v_active := p_scheduled_date=v_today and v_activity=v_today and v_quest.state='active';
 if v_active then
  select * into v_streak from public.streak_states
   where owner_user_id=v_owner and quest_id=p_quest_id for update;
  if found and v_streak.generation=v_period.generation and
   v_streak.outcome_id is not distinct from p_outcome_id and
   v_streak.last_scheduled_date<p_scheduled_date then
    select min(d)::date into v_last_due from generate_series(v_streak.last_scheduled_date+1,p_scheduled_date-1,interval '1 day') as d
     where app_private.schedule_due(v_period.schedule_spec,d::date);
    if v_last_due is null then v_length := v_streak.current_length+1; end if;
  end if;
  if v_length%3=0 then
   foreach v_key in array array['STR','INT','VIT','DIS','BNK'] loop
    if coalesce((v_effects->>v_key)::integer,0)>0 then v_bonus:=jsonb_set(v_bonus,array[v_key],'1'::jsonb,true); end if;
    if coalesce((v_effects->>v_key)::integer,0)<0 then v_bonus:=jsonb_set(v_bonus,array[v_key],'-1'::jsonb,true); end if;
   end loop;
  end if;
  insert into public.streak_states(owner_user_id,quest_id,outcome_id,generation,current_length,last_scheduled_date)
   values(v_owner,p_quest_id,p_outcome_id,v_period.generation,v_length,p_scheduled_date)
   on conflict(owner_user_id,quest_id) do update set outcome_id=excluded.outcome_id,generation=excluded.generation,
    current_length=excluded.current_length,last_scheduled_date=excluded.last_scheduled_date;
 end if;
 if v_existing.id is null then
  insert into public.quest_occurrences(owner_user_id,quest_id,period_id,scheduled_date,actual_activity_date,status,selected_outcome_id,recorded_at)
   values(v_owner,p_quest_id,v_period.id,p_scheduled_date,v_activity,'completed',p_outcome_id,now()) returning * into v_saved;
 else
  update public.quest_occurrences set actual_activity_date=v_activity,status='completed',selected_outcome_id=p_outcome_id,
   version=version+1,recorded_at=now(),updated_at=now() where id=v_existing.id returning * into v_saved;
 end if;
 v_snapshot := jsonb_build_object('quest_type',v_quest.type,'quest_name',v_quest.name,'schedule',v_period.schedule_spec,'outcome_id',p_outcome_id,'outcome_label',v_outcome_label,'streak_eligible',v_active);
 insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,scheduled_date,activity_date,config_snapshot,raw_effects,streak_effects)
  values(v_owner,'quest',v_saved.id,v_saved.version,p_scheduled_date,v_activity,v_snapshot,v_effects,v_bonus);
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
  values(v_owner,'quest_occurrence',v_saved.id,'completed',to_jsonb(v_saved));
 perform app_private.rebuild_owner(v_owner);
 return v_saved;
end $$;
revoke all on function public.record_quest(uuid,date,uuid,date) from public,anon;
grant execute on function public.record_quest(uuid,date,uuid,date) to authenticated;
