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
  if length(btrim(coalesce(v_step->>'name',''))) not between 1 and 200 or
   app_private.valid_schedule(v_step->'schedule') is not true or app_private.valid_effects(v_step->'effects') is not true then
   raise exception 'INVALID_HOBBY_STEP' using errcode='22023'; end if;
  insert into public.hobby_steps(owner_user_id,hobby_id,name,schedule_spec,effects,ordinal)
   values(v_owner,v_hobby.id,btrim(v_step->>'name'),v_step->'schedule',v_step->'effects',v_ordinal);
 end loop;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
  values(v_owner,'hobby',v_hobby.id,'created',to_jsonb(v_hobby));
 return v_hobby;
end $$;
revoke all on function public.create_hobby(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.create_hobby(text,text,jsonb,jsonb) to authenticated;

create or replace function public.record_hobby_step(p_step_id uuid,p_scheduled_date date,p_activity_date date default null)
returns public.hobby_occurrences language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_step public.hobby_steps%rowtype; v_hobby public.hobbies%rowtype;
 v_saved public.hobby_occurrences%rowtype; v_today date; v_calendar_today date; v_activity date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_step from public.hobby_steps where id=p_step_id and owner_user_id=v_owner for update;
 if not found or v_step.state<>'active' then raise exception 'HOBBY_STEP_NOT_FOUND' using errcode='22023'; end if;
 select * into v_saved from public.hobby_occurrences where owner_user_id=v_owner and step_id=p_step_id and scheduled_date=p_scheduled_date for update;
 if found and v_saved.completed_at is not null then return v_saved; end if;
 select * into v_hobby from public.hobbies where id=v_step.hobby_id and owner_user_id=v_owner for update;
 if v_hobby.state<>'active' then raise exception 'HOBBY_NOT_ACTIVE' using errcode='22023'; end if;
 if p_scheduled_date is null or app_private.schedule_due(v_step.schedule_spec,p_scheduled_date) is not true then
  raise exception 'HOBBY_STEP_NOT_DUE' using errcode='22023'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date,timezone(time_zone,now())::date
  into v_today,v_calendar_today from public.profiles where user_id=v_owner;
 v_activity:=coalesce(p_activity_date,v_today);
 if p_scheduled_date>v_today or v_activity>v_calendar_today or p_scheduled_date<v_step.active_from then
  raise exception 'INVALID_HOBBY_DATE' using errcode='22023'; end if;
 if exists(select 1 from public.hobby_reschedules where owner_user_id=v_owner and step_id=p_step_id
  and scheduled_date=p_scheduled_date and rescheduled_for>v_today) then
  raise exception 'RESCHEDULED_FOR_FUTURE' using errcode='22023'; end if;
 if v_saved.id is null then
  insert into public.hobby_occurrences(owner_user_id,step_id,scheduled_date,actual_activity_date,completed_at)
   values(v_owner,p_step_id,p_scheduled_date,v_activity,now()) returning * into v_saved;
 else
  update public.hobby_occurrences set actual_activity_date=v_activity,completed_at=now(),version=version+1
   where id=v_saved.id returning * into v_saved;
 end if;
 insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,scheduled_date,activity_date,config_snapshot,raw_effects,streak_effects)
  values(v_owner,'hobby',v_saved.id,v_saved.version,p_scheduled_date,v_activity,
   jsonb_build_object('hobby_id',v_hobby.id,'hobby_name',v_hobby.name,'step_id',v_step.id,'step_name',v_step.name,'schedule',v_step.schedule_spec),v_step.effects,'{}'::jsonb);
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
  values(v_owner,'hobby_occurrence',v_saved.id,'completed',to_jsonb(v_saved));
 perform app_private.rebuild_owner(v_owner);
 return v_saved;
end $$;
revoke all on function public.record_hobby_step(uuid,date,date) from public,anon;
grant execute on function public.record_hobby_step(uuid,date,date) to authenticated;

create or replace function public.change_hobby_state(p_hobby_id uuid,p_action text,p_expected_version integer)
returns public.hobbies language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_hobby public.hobbies%rowtype; v_saved public.hobbies%rowtype; v_new public.lifecycle;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_hobby from public.hobbies where id=p_hobby_id and owner_user_id=v_owner for update;
 if not found then raise exception 'HOBBY_NOT_FOUND' using errcode='22023'; end if;
 if p_action='archive' and v_hobby.state='active' then v_new:='archived';
 elsif p_action='restore' and v_hobby.state='archived' then v_new:='active';
 elsif p_action='delete' and v_hobby.state in ('active','archived') then v_new:='deleted';
 else raise exception 'INVALID_HOBBY_TRANSITION' using errcode='22023'; end if;
 if p_expected_version is distinct from v_hobby.version then raise exception 'STALE_HOBBY' using errcode='40001'; end if;
 update public.hobbies set state=v_new,version=version+1 where id=p_hobby_id returning * into v_saved;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'hobby',p_hobby_id,p_action,to_jsonb(v_hobby),to_jsonb(v_saved));
 return v_saved;
end $$;
revoke all on function public.change_hobby_state(uuid,text,integer) from public,anon;
grant execute on function public.change_hobby_state(uuid,text,integer) to authenticated;

create or replace function public.finish_hobby(p_hobby_id uuid,p_expected_version integer)
returns public.hobbies language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_hobby public.hobbies%rowtype; v_saved public.hobbies%rowtype;
 v_finish public.hobby_finish_awards%rowtype; v_today date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_hobby from public.hobbies where id=p_hobby_id and owner_user_id=v_owner for update;
 if not found then raise exception 'HOBBY_NOT_FOUND' using errcode='22023'; end if;
 if v_hobby.state='finished' then return v_hobby; end if;
 if v_hobby.state<>'active' then raise exception 'HOBBY_NOT_ACTIVE' using errcode='22023'; end if;
 if p_expected_version is distinct from v_hobby.version then raise exception 'STALE_HOBBY' using errcode='40001'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date into v_today from public.profiles where user_id=v_owner;
 insert into public.hobby_finish_awards(owner_user_id,hobby_id,actual_activity_date,effects_snapshot)
  values(v_owner,p_hobby_id,v_today,v_hobby.finish_effects) returning * into v_finish;
 insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,activity_date,config_snapshot,raw_effects,streak_effects)
  values(v_owner,'finish',v_finish.id,1,v_today,jsonb_build_object('hobby_id',p_hobby_id,'hobby_name',v_hobby.name),v_hobby.finish_effects,'{}'::jsonb);
 update public.hobbies set state='finished',finished_at=now(),version=version+1 where id=p_hobby_id returning * into v_saved;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'hobby',p_hobby_id,'finished',to_jsonb(v_hobby),to_jsonb(v_saved));
 perform app_private.rebuild_owner(v_owner);
 return v_saved;
end $$;
revoke all on function public.finish_hobby(uuid,integer) from public,anon;
grant execute on function public.finish_hobby(uuid,integer) to authenticated;
