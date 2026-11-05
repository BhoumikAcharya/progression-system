alter table public.profiles add column report_claimed_quest_day date;

create or replace function public.claim_morning_report() returns date
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_profile public.profiles%rowtype; v_day date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into v_profile from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 v_day:=(timezone(v_profile.time_zone,now())-interval '3 hours')::date;
 perform app_private.reconcile_owner(v_owner);
 if v_profile.report_claimed_quest_day>=v_day or v_profile.last_report_seen_quest_day>=v_day then return null; end if;
 update public.profiles set report_claimed_quest_day=v_day where user_id=v_owner;
 return v_day-1;
end $$;
revoke all on function public.claim_morning_report() from public,anon;
grant execute on function public.claim_morning_report() to authenticated;

create or replace function public.dismiss_morning_report(p_quest_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_profile public.profiles%rowtype;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select * into v_profile from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 if p_quest_day is distinct from v_profile.report_claimed_quest_day then
  raise exception 'REPORT_DAY_NOT_CLAIMED' using errcode='22023'; end if;
 update public.profiles set last_report_seen_quest_day=greatest(coalesce(last_report_seen_quest_day,p_quest_day),p_quest_day)
  where user_id=v_owner;
end $$;
revoke all on function public.dismiss_morning_report(date) from public,anon;
grant execute on function public.dismiss_morning_report(date) to authenticated;

create or replace function public.correct_quest_occurrence(
 p_occurrence_id uuid,p_expected_version integer,p_new_outcome_id uuid,p_new_activity_date date
) returns public.quest_occurrences language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_occ public.quest_occurrences%rowtype;
 v_saved public.quest_occurrences%rowtype; v_old public.reward_source_events%rowtype;
 v_today date; v_calendar_today date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_occ from public.quest_occurrences where id=p_occurrence_id and owner_user_id=v_owner for update;
 if not found or v_occ.status<>'completed' then raise exception 'OCCURRENCE_NOT_COMPLETED' using errcode='22023'; end if;
 if v_occ.version is distinct from p_expected_version then raise exception 'STALE_QUEST_OCCURRENCE' using errcode='40001'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date,timezone(time_zone,now())::date
  into v_today,v_calendar_today from public.profiles where user_id=v_owner;
 if v_occ.scheduled_date>=v_today or p_new_activity_date is null or p_new_activity_date>v_calendar_today then
  raise exception 'HISTORICAL_CORRECTION_REQUIRED' using errcode='22023'; end if;
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
