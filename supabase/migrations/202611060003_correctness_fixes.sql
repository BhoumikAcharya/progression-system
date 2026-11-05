-- Correctness fixes found in review. Function bodies are otherwise unchanged.

-- 1. Same-day awards replay in time order instead of random ID order.
create or replace function app_private.rebuild_owner(p_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
 v_stats jsonb := '{"STR":0,"INT":0,"VIT":0,"DIS":0,"BNK":0}'::jsonb;
 v_xp bigint := 0; v_event public.reward_source_events%rowtype;
 v_key text; v_raw integer; v_streak integer; v_before integer; v_after integer; v_effective integer;
 v_credit bigint; v_level integer; v_cost bigint := 400; v_cumulative bigint := 0;
begin
 -- Caller holds this owner profile lock. Event order is deterministic after correction.
 for v_event in select e.* from public.reward_source_events e
   where e.owner_user_id=p_owner and e.valid=true
   -- Time order within a day. A corrected award keeps the place of its first revision.
   order by e.activity_date,
    (select min(first_revision.recorded_at) from public.reward_source_events first_revision
      where first_revision.owner_user_id=e.owner_user_id and first_revision.source_type=e.source_type
       and first_revision.source_id=e.source_id),
    e.source_type, e.source_id, e.revision
 loop
   v_credit := 0;
   foreach v_key in array array['STR','INT','VIT','DIS','BNK'] loop
     v_raw := coalesce((v_event.raw_effects->>v_key)::integer,0);
     v_streak := coalesce((v_event.streak_effects->>v_key)::integer,0);
     v_before := (v_stats->>v_key)::integer;
     v_after := greatest(0,v_before+v_raw+v_streak);
     v_effective := v_after-v_before;
     v_stats := jsonb_set(v_stats,array[v_key],to_jsonb(v_after),true);
     v_credit := v_credit + greatest(0,v_effective)::bigint*150;
     insert into public.stat_ledger_entries(owner_user_id,source_event_id,stat_key,raw_delta,streak_delta,effective_delta,activity_date)
     values(p_owner,v_event.id,v_key,v_raw,v_streak,v_effective,v_event.activity_date)
     on conflict(source_event_id,stat_key) do update set effective_delta=excluded.effective_delta,activity_date=excluded.activity_date;
   end loop;
   insert into public.xp_ledger_entries(owner_user_id,source_event_id,credit_delta,activity_date,reason)
   values(p_owner,v_event.id,v_credit,v_event.activity_date,'current_award')
   on conflict(source_event_id,reason) do update set credit_delta=excluded.credit_delta,activity_date=excluded.activity_date;
   v_xp := v_xp+v_credit;
 end loop;
 select highest_level_achieved into v_level from public.profiles where user_id=p_owner for update;
 for i in 1..v_level-1 loop
   v_cumulative := v_cumulative+v_cost;
   v_cost := ceil(v_cost*1.15)::bigint;
 end loop;
 while v_xp >= v_cumulative+v_cost loop
   v_cumulative := v_cumulative+v_cost;
   v_cost := ceil(v_cost*1.15)::bigint;
   v_level := v_level+1;
 end loop;
 update public.profiles set stats=v_stats,corrected_lifetime_xp=v_xp,
   highest_level_achieved=v_level,updated_at=now() where user_id=p_owner;
end $$;
revoke all on function app_private.rebuild_owner(uuid) from public, anon, authenticated;

-- 2. Removing a Routine completion clears its ticked steps.
create or replace function public.remove_quest_completion(p_occurrence_id uuid,p_expected_version integer)
returns public.quest_occurrences
language plpgsql security definer set search_path = '' as $$
declare
 v_owner uuid := auth.uid(); v_occ public.quest_occurrences%rowtype;
 v_old public.reward_source_events%rowtype; v_saved public.quest_occurrences%rowtype;
 v_prior_date date; v_prior_period uuid; v_prior_outcome uuid; v_prior_generation integer; v_run integer := 0;
 v_current record; v_due date; v_before jsonb; v_steps jsonb;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_occ from public.quest_occurrences where id=p_occurrence_id and owner_user_id=v_owner for update;
 if not found then raise exception 'OCCURRENCE_NOT_FOUND' using errcode='22023'; end if;
 if v_occ.version<>p_expected_version or v_occ.status<>'completed' then
  raise exception 'STALE_QUEST_OCCURRENCE' using errcode='40001';
 end if;
 select * into v_old from public.reward_source_events
  where owner_user_id=v_owner and source_type='quest' and source_id=v_occ.id and valid=true for update;
 if not found then raise exception 'AWARD_NOT_FOUND' using errcode='22023'; end if;
 update public.reward_source_events set valid=false where id=v_old.id;
 update public.quest_occurrences set status='unreported',selected_outcome_id=null,
  actual_activity_date=null,version=version+1,updated_at=now()
  where id=v_occ.id returning * into v_saved;
 -- A removed Routine starts over, so its steps can be ticked again. The audit keeps what was ticked.
 select coalesce(jsonb_agg(step_id),'[]'::jsonb) into v_steps
  from public.routine_step_completions where occurrence_id=v_occ.id;
 delete from public.routine_step_completions where occurrence_id=v_occ.id;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'quest_occurrence',v_occ.id,'completion_removed',
   to_jsonb(v_occ)||jsonb_build_object('completed_step_ids',v_steps),to_jsonb(v_saved));
 -- Re-evaluate only previously awarded milestone bonuses. A correction can withdraw
 -- dependent bonuses, but historical records never gain a fresh milestone.
 for v_current in
  select o.id,o.scheduled_date,o.period_id,o.selected_outcome_id,e.id as event_id,e.streak_effects,p.schedule_spec,p.generation
  from public.quest_occurrences o
  join public.reward_source_events e on e.source_type='quest' and e.source_id=o.id and e.valid=true
  join public.quest_schedule_periods p on p.id=o.period_id
  where o.owner_user_id=v_owner and o.quest_id=v_occ.quest_id and o.status='completed'
   and e.config_snapshot->>'streak_eligible'='true'
  order by o.scheduled_date,o.id
 loop
  if v_prior_date is null or v_prior_period is distinct from v_current.period_id or
     v_prior_outcome is distinct from v_current.selected_outcome_id then
   v_run := 1;
  else
   select min(d)::date into v_due from generate_series(v_prior_date+1,v_current.scheduled_date-1,interval '1 day') as d
    where app_private.schedule_due(v_current.schedule_spec,d::date);
   v_run := case when v_due is null then v_run+1 else 1 end;
  end if;
  if v_current.streak_effects<>'{}'::jsonb and v_run%3<>0 then
   v_before:=v_current.streak_effects;
   update public.reward_source_events set streak_effects='{}'::jsonb where id=v_current.event_id;
   insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
    values(v_owner,'reward_source_event',v_current.event_id,'dependent_bonus_withdrawn',v_before,'{}'::jsonb);
  end if;
  v_prior_date:=v_current.scheduled_date;
  v_prior_period:=v_current.period_id;
  v_prior_outcome:=v_current.selected_outcome_id;
  v_prior_generation:=v_current.generation;
 end loop;
 update public.streak_states set current_length=v_run,last_scheduled_date=v_prior_date,
  outcome_id=v_prior_outcome,generation=coalesce(v_prior_generation,generation)
  where owner_user_id=v_owner and quest_id=v_occ.quest_id;
 perform app_private.rebuild_owner(v_owner);
 return v_saved;
end $$;
revoke all on function public.remove_quest_completion(uuid,integer) from public,anon;
grant execute on function public.remove_quest_completion(uuid,integer) to authenticated;

-- 3. Completed one-time quests archive after the rollover.
create or replace function app_private.reconcile_owner(p_owner uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_day date; v_period public.quest_schedule_periods%rowtype;
 v_date date; v_inserted integer; v_count integer:=0; v_quest public.quest_definitions%rowtype;
 v_saved public.quest_definitions%rowtype;
begin
 select (timezone(time_zone,now())-interval '3 hours')::date into v_day
  from public.profiles where user_id=p_owner for update;
 if v_day is null then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 for v_period in select * from public.quest_schedule_periods where owner_user_id=p_owner and active_from<v_day loop
  for v_date in select d::date from generate_series(v_period.active_from,
   least(coalesce(v_period.active_through,v_day-1),v_day-1),interval '1 day') as d loop
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
 end loop;
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

-- Repair existing data. An unreported occurrence with ticked steps can only come from a removal.
delete from public.routine_step_completions c using public.quest_occurrences o
 where c.occurrence_id=o.id and o.status='unreported';
-- Recompute stats in the new order. XP and levels cannot change: gains are never floor-limited.
do $$ declare v_owner uuid; begin
 for v_owner in select user_id from public.profiles for update loop
  perform app_private.rebuild_owner(v_owner);
 end loop;
end $$;
