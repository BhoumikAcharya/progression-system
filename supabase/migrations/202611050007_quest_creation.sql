create or replace function app_private.valid_effects(p_effects jsonb) returns boolean
language sql immutable set search_path = '' as $$
 select jsonb_typeof(p_effects)='object' and
  not exists(select 1 from jsonb_each(p_effects) as e(key,value)
    where key not in ('STR','INT','VIT','DIS','BNK') or jsonb_typeof(value)<>'number'
      or value::text !~ '^-?[0-9]+$' or abs((value::text)::numeric)>2147483647)
$$;
revoke all on function app_private.valid_effects(jsonb) from public,anon,authenticated;

create or replace function app_private.valid_schedule(p_spec jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text:=p_spec->>'kind'; v integer;
begin
 if jsonb_typeof(p_spec)<>'object' then return false; end if;
 case k
 when 'DAILY' then return true;
 when 'WEEKDAYS' then
  return jsonb_typeof(p_spec->'weekdays')='array' and jsonb_array_length(p_spec->'weekdays') between 1 and 7
   and not exists(select 1 from jsonb_array_elements_text(p_spec->'weekdays') n where n !~ '^[1-7]$');
 when 'MONTHLY' then v:=(p_spec->>'day')::integer; return v between 1 and 31;
 when 'YEARLY' then
  perform pg_catalog.make_date(2000,(p_spec->>'month')::integer,(p_spec->>'day')::integer);
  return true;
 when 'ONCE' then return (p_spec->>'date')::date is not null;
 else return false;
 end case;
exception when others then return false;
end $$;
revoke all on function app_private.valid_schedule(jsonb) from public,anon,authenticated;

create or replace function public.create_quest(p_type public.quest_type,p_name text,p_description text,
 p_schedule jsonb,p_effects jsonb,p_outcomes jsonb default null,p_steps jsonb default null)
returns public.quest_definitions
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_q public.quest_definitions%rowtype;
 v_today date; v_item jsonb; v_slot integer:=0; v_ordinal integer:=0;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 if p_type is null or length(btrim(coalesce(p_name,''))) not between 1 and 200 or
   not app_private.valid_schedule(p_schedule) or not app_private.valid_effects(coalesce(p_effects,'{}'::jsonb)) then
  raise exception 'INVALID_QUEST' using errcode='22023';
 end if;
 if p_type='volatile' and (jsonb_typeof(p_outcomes)<>'array' or jsonb_array_length(p_outcomes)<>2) then
  raise exception 'TWO_OUTCOMES_REQUIRED' using errcode='22023';
 end if;
 if p_type='routine' and (jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps)<1) then
  raise exception 'ROUTINE_STEPS_REQUIRED' using errcode='22023';
 end if;
 select (timezone(time_zone,now())-interval '3 hours')::date into v_today from public.profiles where user_id=v_owner;
 insert into public.quest_definitions(owner_user_id,type,name,description,schedule_spec,effects)
  values(v_owner,p_type,btrim(p_name),nullif(btrim(coalesce(p_description,'')),''),p_schedule,
   case when p_type='volatile' then '{}'::jsonb else p_effects end) returning * into v_q;
 insert into public.quest_schedule_periods(owner_user_id,quest_id,generation,active_from,schedule_spec)
  values(v_owner,v_q.id,1,v_today,p_schedule);
 if p_type='volatile' then
  for v_item in select value from jsonb_array_elements(p_outcomes) loop
   v_slot:=v_slot+1;
   if length(btrim(coalesce(v_item->>'label','')))<1 or not app_private.valid_effects(v_item->'effects') then
    raise exception 'INVALID_OUTCOME' using errcode='22023';
   end if;
   insert into public.quest_outcomes(owner_user_id,quest_id,slot,label,effects)
    values(v_owner,v_q.id,v_slot,btrim(v_item->>'label'),v_item->'effects');
  end loop;
 end if;
 if p_type='routine' then
  for v_item in select value from jsonb_array_elements(p_steps) loop
   v_ordinal:=v_ordinal+1;
   if length(btrim(coalesce(v_item#>>'{}','')))<1 then raise exception 'INVALID_ROUTINE_STEP' using errcode='22023'; end if;
   insert into public.routine_steps(owner_user_id,quest_id,name,ordinal)
    values(v_owner,v_q.id,btrim(v_item#>>'{}'),v_ordinal);
  end loop;
 end if;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
  values(v_owner,'quest_definition',v_q.id,'created',to_jsonb(v_q));
 return v_q;
end $$;
revoke all on function public.create_quest(public.quest_type,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.create_quest(public.quest_type,text,text,jsonb,jsonb,jsonb,jsonb) to authenticated;
