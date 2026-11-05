-- First transactional source: sleep. All effects are derived on the server.
-- Quest/hobby write RPCs will use the same locked-profile and projection pattern.
create or replace function app_private.rebuild_owner(p_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
 v_stats jsonb := '{"STR":0,"INT":0,"VIT":0,"DIS":0,"BNK":0}'::jsonb;
 v_xp bigint := 0; v_event public.reward_source_events%rowtype;
 v_key text; v_raw integer; v_streak integer; v_before integer; v_after integer; v_effective integer;
 v_credit bigint; v_level integer; v_cost bigint := 400; v_cumulative bigint := 0;
begin
 -- Caller holds this owner profile lock. Event order is deterministic after correction.
 for v_event in select * from public.reward_source_events
   where owner_user_id=p_owner and valid=true
   order by activity_date, scheduled_date, source_type, source_id, revision
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

create or replace function public.record_sleep(
 p_night date, p_category public.sleep_category, p_expected_version integer default null
) returns public.sleep_records
language plpgsql security definer set search_path = '' as $$
declare
 v_owner uuid := auth.uid(); v_current public.sleep_records%rowtype;
 v_saved public.sleep_records%rowtype; v_effects jsonb; v_old public.reward_source_events%rowtype; v_today date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_night is null or p_category is null then raise exception 'INVALID_SLEEP_RECORD' using errcode='22023'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select timezone(time_zone,now())::date into v_today from public.profiles where user_id=v_owner;
 if p_night>v_today then raise exception 'FUTURE_SLEEP_NIGHT' using errcode='22023'; end if;
 select * into v_current from public.sleep_records
  where owner_user_id=v_owner and sleep_night_date=p_night for update;
 if found then
   if v_current.category=p_category then return v_current; end if;
   if p_expected_version is distinct from v_current.version then
     raise exception 'STALE_SLEEP_RECORD' using errcode='40001';
   end if;
   update public.sleep_records set category=p_category,version=version+1,updated_at=now()
    where id=v_current.id returning * into v_saved;
   select * into v_old from public.reward_source_events
    where owner_user_id=v_owner and source_type='sleep' and source_id=v_saved.id and valid=true for update;
   update public.reward_source_events set valid=false where id=v_old.id;
 else
   if p_expected_version is not null then raise exception 'STALE_SLEEP_RECORD' using errcode='40001'; end if;
   insert into public.sleep_records(owner_user_id,sleep_night_date,category)
    values(v_owner,p_night,p_category) returning * into v_saved;
 end if;
 v_effects := case p_category when 'EARLY' then '{"VIT":1,"DIS":1}'::jsonb
   when 'MIDDLE' then '{}'::jsonb else '{"DIS":-1}'::jsonb end;
 insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,scheduled_date,activity_date,config_snapshot,raw_effects,streak_effects)
  values(v_owner,'sleep',v_saved.id,v_saved.version,p_night,p_night,
   jsonb_build_object('category',p_category),v_effects,'{}'::jsonb);
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'sleep',v_saved.id,case when v_current.id is null then 'created' else 'corrected' end,
   case when v_current.id is null then null else to_jsonb(v_current) end,to_jsonb(v_saved));
 perform app_private.rebuild_owner(v_owner);
 return v_saved;
end $$;
revoke all on function public.record_sleep(date,public.sleep_category,integer) from public, anon;
grant execute on function public.record_sleep(date,public.sleep_category,integer) to authenticated;
