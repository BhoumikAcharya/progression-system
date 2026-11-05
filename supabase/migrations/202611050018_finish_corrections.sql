alter table public.hobby_finish_awards add column version integer not null default 1 check(version>0);

create or replace function public.correct_hobby_finish(
 p_award_id uuid,p_expected_version integer,p_new_activity_date date,p_new_effects jsonb
) returns public.hobby_finish_awards language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_award public.hobby_finish_awards%rowtype;
 v_saved public.hobby_finish_awards%rowtype; v_old public.reward_source_events%rowtype; v_today date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_award from public.hobby_finish_awards where id=p_award_id and owner_user_id=v_owner for update;
 if not found then raise exception 'FINISH_AWARD_NOT_FOUND' using errcode='22023'; end if;
 if v_award.version is distinct from p_expected_version then raise exception 'STALE_FINISH_AWARD' using errcode='40001'; end if;
 select timezone(time_zone,now())::date into v_today from public.profiles where user_id=v_owner;
 if p_new_activity_date is null or p_new_activity_date>v_today or app_private.valid_effects(p_new_effects) is not true then
  raise exception 'INVALID_FINISH_CORRECTION' using errcode='22023'; end if;
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
