create table public.hobby_reschedules (
 owner_user_id uuid not null, step_id uuid not null, scheduled_date date not null,
 rescheduled_for date not null, updated_at timestamptz not null default now(),
 primary key(owner_user_id,step_id,scheduled_date),
 foreign key(step_id,owner_user_id) references public.hobby_steps(id,owner_user_id)
);
alter table public.hobby_reschedules enable row level security;
create policy owner_select on public.hobby_reschedules for select to authenticated using(owner_user_id=auth.uid());
revoke all on public.hobby_reschedules from anon,authenticated;
grant select on public.hobby_reschedules to authenticated;

create or replace function public.reschedule_hobby_step(p_step_id uuid,p_scheduled_date date,p_new_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_step public.hobby_steps%rowtype; v_hobby public.hobbies%rowtype; v_today date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_step from public.hobby_steps where id=p_step_id and owner_user_id=v_owner for update;
 if not found or v_step.state<>'active' then raise exception 'HOBBY_STEP_NOT_FOUND' using errcode='22023'; end if;
 select * into v_hobby from public.hobbies where id=v_step.hobby_id and owner_user_id=v_owner;
 if v_hobby.state<>'active' then raise exception 'HOBBY_NOT_ACTIVE' using errcode='22023'; end if;
 select (timezone(time_zone,now())-interval '3 hours')::date into v_today from public.profiles where user_id=v_owner;
 if p_scheduled_date is null or p_scheduled_date>=v_today or p_scheduled_date<v_step.active_from or
  app_private.schedule_due(v_step.schedule_spec,p_scheduled_date) is not true or p_new_date is null or p_new_date<v_today then
  raise exception 'INVALID_RESCHEDULE' using errcode='22023'; end if;
 if exists(select 1 from public.hobby_occurrences where owner_user_id=v_owner and step_id=p_step_id and scheduled_date=p_scheduled_date and completed_at is not null) then
  raise exception 'ALREADY_COMPLETED' using errcode='22023'; end if;
 insert into public.hobby_reschedules(owner_user_id,step_id,scheduled_date,rescheduled_for)
  values(v_owner,p_step_id,p_scheduled_date,p_new_date)
  on conflict(owner_user_id,step_id,scheduled_date) do update set rescheduled_for=excluded.rescheduled_for,updated_at=now();
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
  values(v_owner,'hobby_step',p_step_id,'rescheduled',jsonb_build_object('scheduled_date',p_scheduled_date,'rescheduled_for',p_new_date));
end $$;
revoke all on function public.reschedule_hobby_step(uuid,date,date) from public,anon;
grant execute on function public.reschedule_hobby_step(uuid,date,date) to authenticated;
