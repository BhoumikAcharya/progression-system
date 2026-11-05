create or replace function public.record_historical_routine(
 p_quest_id uuid,p_scheduled_date date,p_activity_date date,p_step_ids uuid[]
) returns public.quest_occurrences language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_quest public.quest_definitions%rowtype;
 v_period public.quest_schedule_periods%rowtype; v_occ public.quest_occurrences%rowtype;
 v_today date; v_calendar_today date; v_step uuid;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_quest from public.quest_definitions where id=p_quest_id and owner_user_id=v_owner and type='routine';
 if not found then raise exception 'ROUTINE_NOT_FOUND' using errcode='22023'; end if;
 select * into v_occ from public.quest_occurrences where owner_user_id=v_owner and quest_id=p_quest_id and scheduled_date=p_scheduled_date for update;
 if found and v_occ.status='completed' then return v_occ; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date,timezone(time_zone,now())::date
  into v_today,v_calendar_today from public.profiles where user_id=v_owner;
 if p_scheduled_date is null or p_scheduled_date>=v_today or p_activity_date is null or p_activity_date>v_calendar_today then
  raise exception 'INVALID_HISTORICAL_DATE' using errcode='22023'; end if;
 select * into v_period from public.quest_schedule_periods where quest_id=p_quest_id and owner_user_id=v_owner
  and active_from<=p_scheduled_date and (active_through is null or active_through>=p_scheduled_date)
  order by generation desc limit 1;
 if not found or app_private.schedule_due(v_period.schedule_spec,p_scheduled_date) is not true then
  raise exception 'ROUTINE_NOT_DUE' using errcode='22023'; end if;
 if p_step_ids is null or cardinality(p_step_ids)<>(select count(*) from public.routine_steps where quest_id=p_quest_id) or
  (select count(distinct id) from public.routine_steps where quest_id=p_quest_id and id=any(p_step_ids))<>cardinality(p_step_ids) then
  raise exception 'ALL_STEPS_REQUIRED' using errcode='22023'; end if;
 if v_occ.id is null then
  insert into public.quest_occurrences(owner_user_id,quest_id,period_id,scheduled_date,status)
   values(v_owner,p_quest_id,v_period.id,p_scheduled_date,'partial') returning * into v_occ;
 end if;
 foreach v_step in array p_step_ids loop
  insert into public.routine_step_completions(owner_user_id,occurrence_id,step_id,completed_at)
   values(v_owner,v_occ.id,v_step,now()) on conflict(occurrence_id,step_id) do update set completed_at=excluded.completed_at;
 end loop;
 return public.record_quest(p_quest_id,p_scheduled_date,null,p_activity_date);
end $$;
revoke all on function public.record_historical_routine(uuid,date,date,uuid[]) from public,anon;
grant execute on function public.record_historical_routine(uuid,date,date,uuid[]) to authenticated;
