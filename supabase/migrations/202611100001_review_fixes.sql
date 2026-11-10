-- Review fixes, 2026-11-10. Function bodies are otherwise unchanged from their last revision.
--  1. Reconciliation keeps a watermark so each load only closes days not yet closed.
--  2. Same-day corrections: today's quest choice can be changed or removed; a routine step
--     can be un-ticked before the parent is awarded.
--  3. Activity dates cannot be moved before the quest period or hobby existed.
--  4. Hobby subtasks are a dateless checklist. Each task awards once; a repeatable task may
--     be completed once per quest day. Legacy scheduled steps keep their history.
--  5. An archived To-Do root can be un-ticked, which restores it without clearing children.

-- 1. Reconcile watermark -----------------------------------------------------------
alter table public.profiles add column last_reconciled_quest_day date;

create or replace function app_private.reconcile_owner(p_owner uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_day date; v_watermark date; v_period public.quest_schedule_periods%rowtype;
 v_date date; v_start date; v_end date; v_inserted integer; v_count integer:=0;
 v_quest public.quest_definitions%rowtype; v_saved public.quest_definitions%rowtype;
begin
 select (timezone(time_zone,now())-interval '3 hours')::date,last_reconciled_quest_day
  into v_day,v_watermark from public.profiles where user_id=p_owner for update;
 if v_day is null then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 -- Every quest day before the watermark is already closed. Only newer days are scanned.
 if v_watermark is null or v_watermark<v_day-1 then
  for v_period in select * from public.quest_schedule_periods
    where owner_user_id=p_owner and active_from<v_day
     and (active_through is null or v_watermark is null or active_through>v_watermark) loop
   v_start:=greatest(v_period.active_from,coalesce(v_watermark+1,v_period.active_from));
   v_end:=least(coalesce(v_period.active_through,v_day-1),v_day-1);
   if v_start<=v_end then
    for v_date in select d::date from generate_series(v_start,v_end,interval '1 day') as d loop
     if app_private.schedule_due(v_period.schedule_spec,v_date) is true then
      insert into public.quest_occurrences(owner_user_id,quest_id,period_id,scheduled_date,status)
       values(p_owner,v_period.quest_id,v_period.id,v_date,'unreported')
       on conflict(owner_user_id,quest_id,scheduled_date) do nothing;
      get diagnostics v_inserted = row_count;
      v_count:=v_count+v_inserted;
      if v_inserted=1 then
       update public.streak_states set current_length=0,last_scheduled_date=null
        where owner_user_id=p_owner and quest_id=v_period.quest_id
         and last_scheduled_date<v_date;
      end if;
     end if;
    end loop;
   end if;
  end loop;
  update public.profiles set last_reconciled_quest_day=v_day-1 where user_id=p_owner;
 end if;
 -- A completed one-time quest archives at the first rollover after its date.
 for v_quest in select q.* from public.quest_definitions q
   where q.owner_user_id=p_owner and q.state='active' and q.schedule_spec->>'kind'='ONCE'
    and exists(select 1 from public.quest_occurrences o where o.owner_user_id=p_owner
     and o.quest_id=q.id and o.status='completed' and o.scheduled_date<v_day)
   for update of q
 loop
  update public.quest_schedule_periods set active_through=greatest(active_from,v_day-1)
   where owner_user_id=p_owner and quest_id=v_quest.id and active_through is null;
  update public.quest_definitions set state='archived',version=version+1,updated_at=now()
   where id=v_quest.id returning * into v_saved;
  delete from public.streak_states where owner_user_id=p_owner and quest_id=v_quest.id;
  insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
   values(p_owner,'quest',v_quest.id,'auto_archived',to_jsonb(v_quest),to_jsonb(v_saved));
 end loop;
 return v_count;
end $$;
revoke all on function app_private.reconcile_owner(uuid) from public,anon,authenticated;

-- 2 and 3. Quest recording with an activity-date floor -----------------------------
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
 -- An activity cannot predate the schedule period it belongs to.
 if v_activity<v_period.active_from then raise exception 'ACTIVITY_BEFORE_QUEST' using errcode='22023'; end if;
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

-- Today's recorded choice may be corrected in place. Re-recording today stays streak-eligible.
create or replace function public.correct_quest_occurrence(
 p_occurrence_id uuid,p_expected_version integer,p_new_outcome_id uuid,p_new_activity_date date
) returns public.quest_occurrences language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_occ public.quest_occurrences%rowtype;
 v_saved public.quest_occurrences%rowtype; v_old public.reward_source_events%rowtype;
 v_today date; v_calendar_today date; v_period_start date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_occ from public.quest_occurrences where id=p_occurrence_id and owner_user_id=v_owner for update;
 if not found or v_occ.status<>'completed' then raise exception 'OCCURRENCE_NOT_COMPLETED' using errcode='22023'; end if;
 if v_occ.version is distinct from p_expected_version then raise exception 'STALE_QUEST_OCCURRENCE' using errcode='40001'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date,timezone(time_zone,now())::date
  into v_today,v_calendar_today from public.profiles where user_id=v_owner;
 if v_occ.scheduled_date>v_today or p_new_activity_date is null or p_new_activity_date>v_calendar_today then
  raise exception 'INVALID_CORRECTION_DATE' using errcode='22023'; end if;
 select active_from into v_period_start from public.quest_schedule_periods where id=v_occ.period_id;
 if p_new_activity_date<v_period_start then raise exception 'ACTIVITY_BEFORE_QUEST' using errcode='22023'; end if;
 if p_new_outcome_id is not distinct from v_occ.selected_outcome_id then
  if p_new_activity_date=v_occ.actual_activity_date then return v_occ; end if;
  select * into v_old from public.reward_source_events where owner_user_id=v_owner and source_type='quest' and source_id=v_occ.id and valid=true for update;
  if not found then raise exception 'AWARD_NOT_FOUND' using errcode='22023'; end if;
  update public.reward_source_events set valid=false where id=v_old.id;
  update public.quest_occurrences set actual_activity_date=p_new_activity_date,version=version+1,updated_at=now()
   where id=v_occ.id returning * into v_saved;
  insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,scheduled_date,activity_date,config_snapshot,raw_effects,streak_effects)
   values(v_owner,'quest',v_saved.id,v_saved.version,v_saved.scheduled_date,p_new_activity_date,
    v_old.config_snapshot || '{"corrected":true}'::jsonb,v_old.raw_effects,v_old.streak_effects);
  insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
   values(v_owner,'quest_occurrence',v_occ.id,'activity_date_corrected',to_jsonb(v_occ),to_jsonb(v_saved));
  perform app_private.rebuild_owner(v_owner);
  return v_saved;
 end if;
 perform public.remove_quest_completion(p_occurrence_id,p_expected_version);
 return public.record_quest(v_occ.quest_id,v_occ.scheduled_date,p_new_outcome_id,p_new_activity_date);
end $$;
revoke all on function public.correct_quest_occurrence(uuid,integer,uuid,date) from public,anon;
grant execute on function public.correct_quest_occurrence(uuid,integer,uuid,date) to authenticated;

-- A ticked routine step can be un-ticked while the parent is still unawarded.
create or replace function public.unrecord_routine_step(p_quest_id uuid,p_scheduled_date date,p_step_id uuid)
returns public.quest_occurrences
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_day date; v_q public.quest_definitions%rowtype;
 v_occ public.quest_occurrences%rowtype; v_remaining integer;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_q from public.quest_definitions where id=p_quest_id and owner_user_id=v_owner for update;
 if not found or v_q.type<>'routine' or v_q.state<>'active' then raise exception 'ROUTINE_NOT_ACTIVE' using errcode='22023'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date into v_day from public.profiles where user_id=v_owner;
 if p_scheduled_date<>v_day then raise exception 'ROUTINE_NOT_CURRENT' using errcode='22023'; end if;
 select * into v_occ from public.quest_occurrences
  where owner_user_id=v_owner and quest_id=p_quest_id and scheduled_date=v_day for update;
 if not found then raise exception 'STEP_NOT_TICKED' using errcode='22023'; end if;
 if v_occ.status='completed' then raise exception 'ROUTINE_ALREADY_AWARDED' using errcode='22023'; end if;
 delete from public.routine_step_completions where occurrence_id=v_occ.id and step_id=p_step_id and owner_user_id=v_owner;
 if not found then raise exception 'STEP_NOT_TICKED' using errcode='22023'; end if;
 select count(*) into v_remaining from public.routine_step_completions where occurrence_id=v_occ.id and completed_at is not null;
 update public.quest_occurrences set status=case when v_remaining=0 then 'unreported' else 'partial' end,updated_at=now()
  where id=v_occ.id returning * into v_occ;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
  values(v_owner,'quest_occurrence',v_occ.id,'step_unticked',jsonb_build_object('step_id',p_step_id,'status',v_occ.status));
 return v_occ;
end $$;
revoke all on function public.unrecord_routine_step(uuid,date,uuid) from public,anon;
grant execute on function public.unrecord_routine_step(uuid,date,uuid) to authenticated;

-- 4. Hobby tasks: a dateless checklist -------------------------------------------
alter table public.hobby_steps add column repeatable boolean not null default false;

-- A hobby task has no schedule. Older steps may still carry a recurrence for their history.
create or replace function app_private.valid_hobby_task(p_step jsonb) returns boolean
language sql immutable set search_path = '' as $$
 select jsonb_typeof(p_step)='object'
  and length(btrim(coalesce(p_step->>'name','') )) between 1 and 200
  and app_private.valid_effects(p_step->'effects') is true
  and (p_step->'schedule' is null or jsonb_typeof(p_step->'schedule')='null'
       or p_step->'schedule'->>'kind'='TASK' or app_private.valid_schedule(p_step->'schedule') is true)
  and (p_step->'repeatable' is null or jsonb_typeof(p_step->'repeatable')='boolean')
$$;
revoke all on function app_private.valid_hobby_task(jsonb) from public,anon,authenticated;

create or replace function public.create_hobby(p_name text,p_description text,p_finish_effects jsonb,p_steps jsonb)
returns public.hobbies language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_hobby public.hobbies%rowtype; v_step jsonb; v_ordinal integer:=0;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 200 or app_private.valid_effects(p_finish_effects) is not true or
  coalesce(jsonb_typeof(p_steps),'null')<>'array' or coalesce(jsonb_array_length(p_steps),0) not between 1 and 30 then
  raise exception 'INVALID_HOBBY' using errcode='22023'; end if;
 insert into public.hobbies(owner_user_id,name,description,finish_effects)
  values(v_owner,btrim(p_name),nullif(btrim(coalesce(p_description,'')),''),p_finish_effects) returning * into v_hobby;
 for v_step in select value from jsonb_array_elements(p_steps) loop
  v_ordinal:=v_ordinal+1;
  if app_private.valid_hobby_task(v_step) is not true then raise exception 'INVALID_HOBBY_STEP' using errcode='22023'; end if;
  insert into public.hobby_steps(owner_user_id,hobby_id,name,schedule_spec,effects,ordinal,repeatable)
   values(v_owner,v_hobby.id,btrim(v_step->>'name'),
    case when jsonb_typeof(v_step->'schedule')='object' then v_step->'schedule' else '{"kind":"TASK"}'::jsonb end,
    v_step->'effects',v_ordinal,coalesce((v_step->>'repeatable')::boolean,false));
 end loop;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
  values(v_owner,'hobby',v_hobby.id,'created',to_jsonb(v_hobby));
 return v_hobby;
end $$;
revoke all on function public.create_hobby(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.create_hobby(text,text,jsonb,jsonb) to authenticated;

create or replace function public.edit_hobby(p_hobby_id uuid,p_expected_version integer,p_name text,p_description text,p_finish_effects jsonb,p_steps jsonb)
returns public.hobbies language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_hobby public.hobbies%rowtype; v_saved public.hobbies%rowtype; v_today date;
 v_step jsonb; v_step_id uuid; v_ordinal integer:=0; v_seen uuid[]:='{}'::uuid[]; v_schedule jsonb;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_hobby from public.hobbies where id=p_hobby_id and owner_user_id=v_owner for update;
 if not found or v_hobby.state<>'active' then raise exception 'HOBBY_NOT_ACTIVE' using errcode='22023'; end if;
 if p_expected_version is distinct from v_hobby.version then raise exception 'STALE_HOBBY' using errcode='40001'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date into v_today from public.profiles where user_id=v_owner;
 if length(btrim(coalesce(p_name,''))) not between 1 and 200 or app_private.valid_effects(p_finish_effects) is not true or
  coalesce(jsonb_typeof(p_steps),'null')<>'array' or coalesce(jsonb_array_length(p_steps),0) not between 1 and 30 then
  raise exception 'INVALID_HOBBY' using errcode='22023'; end if;
 -- Temporarily free active ordinals so a reorder cannot collide with its old position.
 update public.hobby_steps set ordinal=-ordinal where hobby_id=p_hobby_id and owner_user_id=v_owner and state='active';
 for v_step in select value from jsonb_array_elements(p_steps) loop
  v_ordinal:=v_ordinal+1;
  if app_private.valid_hobby_task(v_step) is not true then raise exception 'INVALID_HOBBY_STEP' using errcode='22023'; end if;
  v_schedule:=case when jsonb_typeof(v_step->'schedule')='object' then v_step->'schedule' else '{"kind":"TASK"}'::jsonb end;
  v_step_id:=nullif(v_step->>'id','')::uuid;
  if v_step_id is null then
   insert into public.hobby_steps(owner_user_id,hobby_id,name,schedule_spec,effects,ordinal,repeatable)
    values(v_owner,p_hobby_id,btrim(v_step->>'name'),v_schedule,v_step->'effects',v_ordinal,coalesce((v_step->>'repeatable')::boolean,false));
  else
   if v_step_id=any(v_seen) then raise exception 'DUPLICATE_HOBBY_STEP' using errcode='22023'; end if;
   update public.hobby_steps set name=btrim(v_step->>'name'),schedule_spec=v_schedule,effects=v_step->'effects',ordinal=v_ordinal,version=version+1,
    repeatable=coalesce((v_step->>'repeatable')::boolean,repeatable),
    active_from=case when schedule_spec is distinct from v_schedule then v_today else active_from end
    where id=v_step_id and hobby_id=p_hobby_id and owner_user_id=v_owner and state='active';
   if not found then raise exception 'HOBBY_STEP_NOT_FOUND' using errcode='22023'; end if;
   v_seen:=array_append(v_seen,v_step_id);
  end if;
 end loop;
 update public.hobby_steps set state='deleted',ordinal=abs(ordinal)
  where hobby_id=p_hobby_id and owner_user_id=v_owner and state='active' and ordinal<0;
 update public.hobbies set name=btrim(p_name),description=nullif(btrim(coalesce(p_description,'')),''),
  finish_effects=p_finish_effects,version=version+1 where id=p_hobby_id returning * into v_saved;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'hobby',p_hobby_id,'edited',to_jsonb(v_hobby),to_jsonb(v_saved));
 return v_saved;
end $$;
revoke all on function public.edit_hobby(uuid,integer,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.edit_hobby(uuid,integer,text,text,jsonb,jsonb) to authenticated;

-- Complete a hobby task today. A plain task awards once ever; a repeatable task once per quest day.
-- Repeating the call returns the stored completion instead of a second award.
create or replace function public.complete_hobby_task(p_step_id uuid)
returns public.hobby_occurrences language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_step public.hobby_steps%rowtype; v_hobby public.hobbies%rowtype;
 v_saved public.hobby_occurrences%rowtype; v_today date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_step from public.hobby_steps where id=p_step_id and owner_user_id=v_owner for update;
 if not found or v_step.state<>'active' then raise exception 'HOBBY_STEP_NOT_FOUND' using errcode='22023'; end if;
 select * into v_hobby from public.hobbies where id=v_step.hobby_id and owner_user_id=v_owner for update;
 if v_hobby.state<>'active' then raise exception 'HOBBY_NOT_ACTIVE' using errcode='22023'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date into v_today from public.profiles where user_id=v_owner;
 if not v_step.repeatable then
  select * into v_saved from public.hobby_occurrences
   where owner_user_id=v_owner and step_id=p_step_id and completed_at is not null
   order by completed_at limit 1;
  if found then return v_saved; end if;
 end if;
 select * into v_saved from public.hobby_occurrences
  where owner_user_id=v_owner and step_id=p_step_id and scheduled_date=v_today for update;
 if found and v_saved.completed_at is not null then return v_saved; end if;
 if v_saved.id is null then
  insert into public.hobby_occurrences(owner_user_id,step_id,scheduled_date,actual_activity_date,completed_at)
   values(v_owner,p_step_id,v_today,v_today,now()) returning * into v_saved;
 else
  update public.hobby_occurrences set actual_activity_date=v_today,completed_at=now(),version=version+1
   where id=v_saved.id returning * into v_saved;
 end if;
 insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,scheduled_date,activity_date,config_snapshot,raw_effects,streak_effects)
  values(v_owner,'hobby',v_saved.id,v_saved.version,v_today,v_today,
   jsonb_build_object('hobby_id',v_hobby.id,'hobby_name',v_hobby.name,'step_id',v_step.id,'step_name',v_step.name,
    'repeatable',v_step.repeatable,'schedule',v_step.schedule_spec),v_step.effects,'{}'::jsonb);
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
  values(v_owner,'hobby_occurrence',v_saved.id,'completed',to_jsonb(v_saved));
 perform app_private.rebuild_owner(v_owner);
 return v_saved;
end $$;
revoke all on function public.complete_hobby_task(uuid) from public,anon;
grant execute on function public.complete_hobby_task(uuid) to authenticated;

-- 3. Hobby corrections cannot predate the hobby.
create or replace function public.correct_hobby_occurrence(
 p_occurrence_id uuid,p_expected_version integer,p_new_activity_date date,
 p_new_effects jsonb default null,p_remove boolean default false
) returns public.hobby_occurrences language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_occ public.hobby_occurrences%rowtype;
 v_saved public.hobby_occurrences%rowtype; v_old public.reward_source_events%rowtype;
 v_today date; v_created date; v_effects jsonb;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_occ from public.hobby_occurrences where id=p_occurrence_id and owner_user_id=v_owner for update;
 if not found or v_occ.completed_at is null then raise exception 'HOBBY_OCCURRENCE_NOT_COMPLETED' using errcode='22023'; end if;
 if v_occ.version is distinct from p_expected_version then raise exception 'STALE_HOBBY_OCCURRENCE' using errcode='40001'; end if;
 select * into v_old from public.reward_source_events where owner_user_id=v_owner and source_type='hobby' and source_id=v_occ.id and valid=true for update;
 if not found then raise exception 'AWARD_NOT_FOUND' using errcode='22023'; end if;
 select timezone(p.time_zone,now())::date,(timezone(p.time_zone,h.created_at)-interval '3 hours')::date
  into v_today,v_created from public.profiles p
  join public.hobby_steps s on s.id=v_occ.step_id join public.hobbies h on h.id=s.hobby_id
  where p.user_id=v_owner;
 if not p_remove and (p_new_activity_date is null or p_new_activity_date>v_today or
   (p_new_effects is not null and app_private.valid_effects(p_new_effects) is not true)) then
  raise exception 'INVALID_HOBBY_CORRECTION' using errcode='22023'; end if;
 if not p_remove and p_new_activity_date<v_created then raise exception 'ACTIVITY_BEFORE_HOBBY' using errcode='22023'; end if;
 v_effects:=coalesce(p_new_effects,v_old.raw_effects);
 update public.reward_source_events set valid=false where id=v_old.id;
 if p_remove then
  update public.hobby_occurrences set completed_at=null,actual_activity_date=null,version=version+1
   where id=v_occ.id returning * into v_saved;
 else
  update public.hobby_occurrences set actual_activity_date=p_new_activity_date,version=version+1
   where id=v_occ.id returning * into v_saved;
  insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,scheduled_date,activity_date,config_snapshot,raw_effects,streak_effects)
   values(v_owner,'hobby',v_saved.id,v_saved.version,v_saved.scheduled_date,p_new_activity_date,
    v_old.config_snapshot || '{"corrected":true}'::jsonb,v_effects,'{}'::jsonb);
 end if;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'hobby_occurrence',v_occ.id,case when p_remove then 'completion_removed' else 'corrected' end,to_jsonb(v_occ),to_jsonb(v_saved));
 perform app_private.rebuild_owner(v_owner);
 return v_saved;
end $$;
revoke all on function public.correct_hobby_occurrence(uuid,integer,date,jsonb,boolean) from public,anon;
grant execute on function public.correct_hobby_occurrence(uuid,integer,date,jsonb,boolean) to authenticated;

create or replace function public.correct_hobby_finish(
 p_award_id uuid,p_expected_version integer,p_new_activity_date date,p_new_effects jsonb
) returns public.hobby_finish_awards language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_award public.hobby_finish_awards%rowtype;
 v_saved public.hobby_finish_awards%rowtype; v_old public.reward_source_events%rowtype; v_today date; v_created date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_award from public.hobby_finish_awards where id=p_award_id and owner_user_id=v_owner for update;
 if not found then raise exception 'FINISH_AWARD_NOT_FOUND' using errcode='22023'; end if;
 if v_award.version is distinct from p_expected_version then raise exception 'STALE_FINISH_AWARD' using errcode='40001'; end if;
 select timezone(p.time_zone,now())::date,(timezone(p.time_zone,h.created_at)-interval '3 hours')::date
  into v_today,v_created from public.profiles p join public.hobbies h on h.id=v_award.hobby_id where p.user_id=v_owner;
 if p_new_activity_date is null or p_new_activity_date>v_today or app_private.valid_effects(p_new_effects) is not true then
  raise exception 'INVALID_FINISH_CORRECTION' using errcode='22023'; end if;
 if p_new_activity_date<v_created then raise exception 'ACTIVITY_BEFORE_HOBBY' using errcode='22023'; end if;
 select * into v_old from public.reward_source_events where owner_user_id=v_owner and source_type='finish' and source_id=v_award.id and valid=true for update;
 if not found then raise exception 'AWARD_NOT_FOUND' using errcode='22023'; end if;
 update public.reward_source_events set valid=false where id=v_old.id;
 update public.hobby_finish_awards set actual_activity_date=p_new_activity_date,effects_snapshot=p_new_effects,version=version+1
  where id=p_award_id returning * into v_saved;
 insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,activity_date,config_snapshot,raw_effects,streak_effects)
  values(v_owner,'finish',v_saved.id,v_saved.version,p_new_activity_date,
   v_old.config_snapshot || '{"corrected":true}'::jsonb,p_new_effects,'{}'::jsonb);
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'hobby_finish_award',p_award_id,'corrected',to_jsonb(v_award),to_jsonb(v_saved));
 perform app_private.rebuild_owner(v_owner);
 return v_saved;
end $$;
revoke all on function public.correct_hobby_finish(uuid,integer,date,jsonb) from public,anon;
grant execute on function public.correct_hobby_finish(uuid,integer,date,jsonb) to authenticated;

-- 5. Un-ticking an archived To-Do root restores it and leaves its children as they were.
create or replace function public.write_todo(
 p_action text,p_id uuid default null,p_title text default null,p_parent_id uuid default null,p_done boolean default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_item public.todo_items%rowtype; v_parent public.todo_items%rowtype;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 if p_action='create' then
  if p_id is null or length(btrim(coalesce(p_title,''))) not between 1 and 200 then
   raise exception 'INVALID_TODO' using errcode='22023'; end if;
  if p_parent_id is not null then
   select * into v_parent from public.todo_items where id=p_parent_id and owner_user_id=v_owner and parent_id is null and not archived and not deleted for update;
   if not found then raise exception 'INVALID_PARENT' using errcode='22023'; end if;
  end if;
  insert into public.todo_items(id,owner_user_id,parent_id,title,position)
   values(p_id,v_owner,p_parent_id,btrim(p_title),coalesce((select max(position)+1 from public.todo_items where owner_user_id=v_owner and parent_id is not distinct from p_parent_id),0))
   on conflict(id) do nothing;
  select * into v_item from public.todo_items where id=p_id and owner_user_id=v_owner;
  if v_item.title<>btrim(p_title) or v_item.parent_id is distinct from p_parent_id then raise exception 'TODO_ID_CONFLICT' using errcode='23505'; end if;
 elsif p_action='toggle' then
  select * into v_item from public.todo_items where id=p_id and owner_user_id=v_owner and not deleted for update;
  if not found or p_done is null then raise exception 'TODO_UNAVAILABLE' using errcode='22023'; end if;
  if v_item.archived then
   -- Only an archived root can be un-ticked. Children keep their own checks.
   if v_item.parent_id is not null or p_done then raise exception 'TODO_UNAVAILABLE' using errcode='22023'; end if;
   update public.todo_items set done=false,archived=false where id=v_item.id;
  elsif v_item.parent_id is null then
   update public.todo_items set done=p_done,archived=p_done where id=v_item.id;
   update public.todo_items set done=p_done where parent_id=v_item.id and owner_user_id=v_owner and not deleted;
  else
   update public.todo_items set done=p_done where id=v_item.id;
   update public.todo_items set done=not exists(select 1 from public.todo_items where parent_id=v_item.parent_id and owner_user_id=v_owner and not deleted and not done),
    archived=not exists(select 1 from public.todo_items where parent_id=v_item.parent_id and owner_user_id=v_owner and not deleted and not done)
    where id=v_item.parent_id and owner_user_id=v_owner;
  end if;
 elsif p_action='restore' then
  select * into v_item from public.todo_items where id=p_id and owner_user_id=v_owner and parent_id is null and archived and not deleted for update;
  if not found then raise exception 'TODO_NOT_ARCHIVED' using errcode='22023'; end if;
  update public.todo_items set done=false,archived=false where id=v_item.id or (parent_id=v_item.id and owner_user_id=v_owner);
 elsif p_action='clear_archive' then
  update public.todo_items set deleted=true where owner_user_id=v_owner and parent_id in
   (select id from public.todo_items where owner_user_id=v_owner and parent_id is null and archived and not deleted);
  update public.todo_items set deleted=true where owner_user_id=v_owner and parent_id is null and archived and not deleted;
 else raise exception 'INVALID_TODO_ACTION' using errcode='22023'; end if;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
 values(v_owner,'todo',coalesce(p_id,v_owner),p_action,jsonb_build_object('title',p_title,'done',p_done));
end $$;
revoke all on function public.write_todo(text,uuid,text,uuid,boolean) from public,anon;
grant execute on function public.write_todo(text,uuid,text,uuid,boolean) to authenticated;
