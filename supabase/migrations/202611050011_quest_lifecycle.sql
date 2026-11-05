create or replace function public.change_quest_state(p_quest_id uuid,p_action text,p_expected_version integer)
returns public.quest_definitions language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_quest public.quest_definitions%rowtype; v_saved public.quest_definitions%rowtype;
 v_today date; v_new public.lifecycle; v_generation integer;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_quest from public.quest_definitions where id=p_quest_id and owner_user_id=v_owner for update;
 if not found then raise exception 'QUEST_NOT_FOUND' using errcode='22023'; end if;
 if p_expected_version is distinct from v_quest.version then raise exception 'STALE_QUEST' using errcode='40001'; end if;
 if p_action='archive' and v_quest.state='active' then v_new:='archived';
 elsif p_action='restore' and v_quest.state='archived' then v_new:='active';
 elsif p_action='delete' and v_quest.state in ('active','archived') then v_new:='deleted';
 else raise exception 'INVALID_QUEST_TRANSITION' using errcode='22023'; end if;
 if p_action='restore' and v_quest.schedule_spec->>'kind'='ONCE' and
  exists(select 1 from public.quest_occurrences where quest_id=p_quest_id and owner_user_id=v_owner and status='completed') then
  raise exception 'COMPLETED_ONCE_CANNOT_RESTORE' using errcode='22023'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date into v_today from public.profiles where user_id=v_owner;
 if p_action in ('archive','delete') then
  update public.quest_schedule_periods set active_through=v_today
   where quest_id=p_quest_id and owner_user_id=v_owner and active_through is null;
 else
  select coalesce(max(generation),0)+1 into v_generation from public.quest_schedule_periods where quest_id=p_quest_id;
  insert into public.quest_schedule_periods(owner_user_id,quest_id,generation,active_from,schedule_spec)
   values(v_owner,p_quest_id,v_generation,v_today,v_quest.schedule_spec);
 end if;
 update public.quest_definitions set state=v_new,version=version+1,updated_at=now()
  where id=p_quest_id returning * into v_saved;
 delete from public.streak_states where owner_user_id=v_owner and quest_id=p_quest_id;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'quest',p_quest_id,p_action,to_jsonb(v_quest),to_jsonb(v_saved));
 return v_saved;
end $$;
revoke all on function public.change_quest_state(uuid,text,integer) from public,anon;
grant execute on function public.change_quest_state(uuid,text,integer) to authenticated;
