create or replace function public.record_routine_step(p_quest_id uuid,p_scheduled_date date,p_step_id uuid)
returns public.quest_occurrences
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_day date; v_q public.quest_definitions%rowtype;
 v_period public.quest_schedule_periods%rowtype; v_occ public.quest_occurrences%rowtype;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_q from public.quest_definitions where id=p_quest_id and owner_user_id=v_owner for update;
 if not found or v_q.type<>'routine' or v_q.state<>'active' then raise exception 'ROUTINE_NOT_ACTIVE' using errcode='22023'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date into v_day from public.profiles where user_id=v_owner;
 if p_scheduled_date<>v_day then raise exception 'ROUTINE_NOT_CURRENT' using errcode='22023'; end if;
 select * into v_period from public.quest_schedule_periods
  where owner_user_id=v_owner and quest_id=p_quest_id and active_from<=v_day
   and (active_through is null or active_through>=v_day)
  order by generation desc limit 1;
 if not found or app_private.schedule_due(v_period.schedule_spec,v_day) is not true then
  raise exception 'ROUTINE_NOT_DUE' using errcode='22023'; end if;
 perform 1 from public.routine_steps where id=p_step_id and quest_id=p_quest_id and owner_user_id=v_owner;
 if not found then raise exception 'STEP_NOT_FOUND' using errcode='22023'; end if;
 select * into v_occ from public.quest_occurrences
  where owner_user_id=v_owner and quest_id=p_quest_id and scheduled_date=v_day for update;
 if v_occ.id is null then
  insert into public.quest_occurrences(owner_user_id,quest_id,period_id,scheduled_date,status)
   values(v_owner,p_quest_id,v_period.id,v_day,'partial') returning * into v_occ;
 end if;
 if v_occ.status='completed' then return v_occ; end if;
 if v_occ.status='unreported' then
  update public.quest_occurrences set status='partial',updated_at=now() where id=v_occ.id returning * into v_occ;
 end if;
 insert into public.routine_step_completions(owner_user_id,occurrence_id,step_id,completed_at)
  values(v_owner,v_occ.id,p_step_id,now()) on conflict(occurrence_id,step_id) do nothing;
 if (select count(*) from public.routine_step_completions where occurrence_id=v_occ.id and completed_at is not null)=
    (select count(*) from public.routine_steps where quest_id=p_quest_id) then
  return public.record_quest(p_quest_id,v_day,null,v_day);
 end if;
 return v_occ;
end $$;
revoke all on function public.record_routine_step(uuid,date,uuid) from public,anon;
grant execute on function public.record_routine_step(uuid,date,uuid) to authenticated;
