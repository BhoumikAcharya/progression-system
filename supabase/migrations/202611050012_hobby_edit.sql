create unique index hobby_active_step_ordinal on public.hobby_steps(hobby_id,ordinal) where state='active';
alter table public.hobby_steps add column active_from date;
update public.hobby_steps s set active_from=(
 select (timezone(p.time_zone,h.created_at)-interval '3 hours')::date
 from public.hobbies h join public.profiles p on p.user_id=h.owner_user_id where h.id=s.hobby_id
);
alter table public.hobby_steps alter column active_from set not null;
create or replace function app_private.hobby_step_start() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.active_from is null then
  select (timezone(time_zone,now())-interval '3 hours')::date into new.active_from
   from public.profiles where user_id=new.owner_user_id;
 end if;
 return new;
end $$;
create trigger hobby_step_start before insert on public.hobby_steps
 for each row execute function app_private.hobby_step_start();
revoke all on function app_private.hobby_step_start() from public,anon,authenticated;

create or replace function public.edit_hobby(p_hobby_id uuid,p_expected_version integer,p_name text,p_description text,p_finish_effects jsonb,p_steps jsonb)
returns public.hobbies language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_hobby public.hobbies%rowtype; v_saved public.hobbies%rowtype; v_today date;
 v_step jsonb; v_step_id uuid; v_ordinal integer:=0; v_seen uuid[]:='{}'::uuid[];
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_hobby from public.hobbies where id=p_hobby_id and owner_user_id=v_owner for update;
 if not found or v_hobby.state<>'active' then raise exception 'HOBBY_NOT_ACTIVE' using errcode='22023'; end if;
 if p_expected_version is distinct from v_hobby.version then raise exception 'STALE_HOBBY' using errcode='40001'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date into v_today from public.profiles where user_id=v_owner;
 if length(btrim(coalesce(p_name,''))) not between 1 and 200 or app_private.valid_effects(p_finish_effects) is not true or
  coalesce(jsonb_typeof(p_steps),'null')<>'array' or coalesce(jsonb_array_length(p_steps),0) not between 1 and 30 then
  raise exception 'INVALID_HOBBY' using errcode='22023'; end if;
 -- Temporarily free active ordinals so a reorder cannot collide with its old position.
 update public.hobby_steps set ordinal=-ordinal where hobby_id=p_hobby_id and owner_user_id=v_owner and state='active';
 for v_step in select value from jsonb_array_elements(p_steps) loop
  v_ordinal:=v_ordinal+1;
  if length(btrim(coalesce(v_step->>'name',''))) not between 1 and 200 or
   app_private.valid_schedule(v_step->'schedule') is not true or app_private.valid_effects(v_step->'effects') is not true then
   raise exception 'INVALID_HOBBY_STEP' using errcode='22023'; end if;
  v_step_id:=nullif(v_step->>'id','')::uuid;
  if v_step_id is null then
   insert into public.hobby_steps(owner_user_id,hobby_id,name,schedule_spec,effects,ordinal)
    values(v_owner,p_hobby_id,btrim(v_step->>'name'),v_step->'schedule',v_step->'effects',v_ordinal);
  else
   if v_step_id=any(v_seen) then raise exception 'DUPLICATE_HOBBY_STEP' using errcode='22023'; end if;
   update public.hobby_steps set name=btrim(v_step->>'name'),schedule_spec=v_step->'schedule',effects=v_step->'effects',ordinal=v_ordinal,version=version+1,
    active_from=case when schedule_spec is distinct from v_step->'schedule' then v_today else active_from end
    where id=v_step_id and hobby_id=p_hobby_id and owner_user_id=v_owner and state='active';
   if not found then raise exception 'HOBBY_STEP_NOT_FOUND' using errcode='22023'; end if;
   v_seen:=array_append(v_seen,v_step_id);
  end if;
 end loop;
 update public.hobby_steps set state='deleted',ordinal=abs(ordinal)
  where hobby_id=p_hobby_id and owner_user_id=v_owner and state='active' and ordinal<0;
 update public.hobbies set name=btrim(p_name),description=nullif(btrim(coalesce(p_description,'')),''),
  finish_effects=p_finish_effects,version=version+1 where id=p_hobby_id returning * into v_saved;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot,after_snapshot)
  values(v_owner,'hobby',p_hobby_id,'edited',to_jsonb(v_hobby),to_jsonb(v_saved));
 return v_saved;
end $$;
revoke all on function public.edit_hobby(uuid,integer,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.edit_hobby(uuid,integer,text,text,jsonb,jsonb) to authenticated;
