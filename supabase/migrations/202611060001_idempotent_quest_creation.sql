-- A stable client request ID prevents repeated taps and uncertain network retries
-- from creating multiple quest definitions. This table is private to the RPC.
create table app_private.quest_creation_requests (
 owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 request_id uuid not null,
 payload jsonb not null,
 quest_id uuid not null references public.quest_definitions(id),
 primary key(owner_user_id,request_id)
);
revoke all on app_private.quest_creation_requests from public,anon,authenticated;

create or replace function public.create_quest_once(
 p_request_id uuid,p_type public.quest_type,p_name text,p_description text,
 p_schedule jsonb,p_effects jsonb,p_outcomes jsonb default null,p_steps jsonb default null
) returns public.quest_definitions
language plpgsql security definer set search_path = '' as $$
declare
 v_owner uuid := auth.uid();
 v_payload jsonb;
 v_request app_private.quest_creation_requests%rowtype;
 v_quest public.quest_definitions%rowtype;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode='22023'; end if;
 v_payload := jsonb_build_object(
  'type',p_type,'name',p_name,'description',p_description,'schedule',p_schedule,
  'effects',p_effects,'outcomes',p_outcomes,'steps',p_steps
 );
 -- Serialize requests from one owner, including two devices racing with the same ID.
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_request from app_private.quest_creation_requests
  where owner_user_id=v_owner and request_id=p_request_id;
 if found then
  if v_request.payload<>v_payload then raise exception 'QUEST_REQUEST_CONFLICT' using errcode='23505'; end if;
  select * into v_quest from public.quest_definitions
   where id=v_request.quest_id and owner_user_id=v_owner;
  if not found then raise exception 'QUEST_NOT_FOUND' using errcode='22023'; end if;
  return v_quest;
 end if;
 select * into v_quest from public.create_quest(
  p_type,p_name,p_description,p_schedule,p_effects,p_outcomes,p_steps
 );
 insert into app_private.quest_creation_requests(owner_user_id,request_id,payload,quest_id)
  values(v_owner,p_request_id,v_payload,v_quest.id);
 return v_quest;
end $$;
revoke all on function public.create_quest_once(uuid,public.quest_type,text,text,jsonb,jsonb,jsonb,jsonb)
 from public,anon;
grant execute on function public.create_quest_once(uuid,public.quest_type,text,text,jsonb,jsonb,jsonb,jsonb)
 to authenticated;
