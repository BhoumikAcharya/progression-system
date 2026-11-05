create or replace function app_private.reconcile_owner(p_owner uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_day date; v_period public.quest_schedule_periods%rowtype;
 v_date date; v_inserted integer; v_count integer:=0;
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
 return v_count;
end $$;
revoke all on function app_private.reconcile_owner(uuid) from public,anon,authenticated;

create or replace function public.reconcile_closed_quests() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid();
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 return app_private.reconcile_owner(v_owner);
end $$;
revoke all on function public.reconcile_closed_quests() from public,anon;
grant execute on function public.reconcile_closed_quests() to authenticated;
