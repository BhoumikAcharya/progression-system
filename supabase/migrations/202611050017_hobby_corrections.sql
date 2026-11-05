create or replace function public.correct_hobby_occurrence(
 p_occurrence_id uuid,p_expected_version integer,p_new_activity_date date,
 p_new_effects jsonb default null,p_remove boolean default false
) returns public.hobby_occurrences language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_occ public.hobby_occurrences%rowtype;
 v_saved public.hobby_occurrences%rowtype; v_old public.reward_source_events%rowtype;
 v_today date; v_effects jsonb;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_occ from public.hobby_occurrences where id=p_occurrence_id and owner_user_id=v_owner for update;
 if not found or v_occ.completed_at is null then raise exception 'HOBBY_OCCURRENCE_NOT_COMPLETED' using errcode='22023'; end if;
 if v_occ.version is distinct from p_expected_version then raise exception 'STALE_HOBBY_OCCURRENCE' using errcode='40001'; end if;
 select * into v_old from public.reward_source_events where owner_user_id=v_owner and source_type='hobby' and source_id=v_occ.id and valid=true for update;
 if not found then raise exception 'AWARD_NOT_FOUND' using errcode='22023'; end if;
 select timezone(time_zone,now())::date into v_today from public.profiles where user_id=v_owner;
 if not p_remove and (p_new_activity_date is null or p_new_activity_date>v_today or
   (p_new_effects is not null and app_private.valid_effects(p_new_effects) is not true)) then
  raise exception 'INVALID_HOBBY_CORRECTION' using errcode='22023'; end if;
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
