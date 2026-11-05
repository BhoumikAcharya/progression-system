-- Versioned removal of an incorrect quest completion. No new historical bonus is created.
create or replace function public.remove_quest_completion(p_occurrence_id uuid,p_expected_version integer)
returns public.quest_occurrences
language plpgsql security definer set search_path = '' as $$
declare
 v_owner uuid := auth.uid(); v_occ public.quest_occurrences%rowtype;
 v_old public.reward_source_events%rowtype; v_saved public.quest_occurrences%rowtype;
 v_prior_date date; v_prior_period uuid; v_prior_outcome uuid; v_prior_generation integer; v_run integer := 0;
 v_current record; v_due date; v_before jsonb;
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
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'quest_occurrence',v_occ.id,'completion_removed',to_jsonb(v_occ),to_jsonb(v_saved));
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
