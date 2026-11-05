create or replace function public.write_todo(
 p_action text,p_id uuid default null,p_title text default null,p_parent_id uuid default null,p_done boolean default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_item public.todo_items%rowtype; v_parent public.todo_items%rowtype;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 if p_action='create' then
  if p_id is null or length(btrim(coalesce(p_title,''))) not between 1 and 200 then
   raise exception 'INVALID_TODO' using errcode='22023'; end if;
  if p_parent_id is not null then
   select * into v_parent from public.todo_items where id=p_parent_id and owner_user_id=v_owner and parent_id is null and not archived and not deleted for update;
   if not found then raise exception 'INVALID_PARENT' using errcode='22023'; end if;
  end if;
  insert into public.todo_items(id,owner_user_id,parent_id,title,position)
   values(p_id,v_owner,p_parent_id,btrim(p_title),coalesce((select max(position)+1 from public.todo_items where owner_user_id=v_owner and parent_id is not distinct from p_parent_id),0))
   on conflict(id) do nothing;
  select * into v_item from public.todo_items where id=p_id and owner_user_id=v_owner;
  if v_item.title<>btrim(p_title) or v_item.parent_id is distinct from p_parent_id then raise exception 'TODO_ID_CONFLICT' using errcode='23505'; end if;
 elsif p_action='toggle' then
  select * into v_item from public.todo_items where id=p_id and owner_user_id=v_owner and not deleted for update;
  if not found or p_done is null or v_item.archived then raise exception 'TODO_UNAVAILABLE' using errcode='22023'; end if;
  if v_item.parent_id is null then
   update public.todo_items set done=p_done,archived=p_done where id=v_item.id;
   update public.todo_items set done=p_done where parent_id=v_item.id and owner_user_id=v_owner and not deleted;
  else
   update public.todo_items set done=p_done where id=v_item.id;
   update public.todo_items set done=not exists(select 1 from public.todo_items where parent_id=v_item.parent_id and owner_user_id=v_owner and not deleted and not done),
    archived=not exists(select 1 from public.todo_items where parent_id=v_item.parent_id and owner_user_id=v_owner and not deleted and not done)
    where id=v_item.parent_id and owner_user_id=v_owner;
  end if;
 elsif p_action='restore' then
  select * into v_item from public.todo_items where id=p_id and owner_user_id=v_owner and parent_id is null and archived and not deleted for update;
  if not found then raise exception 'TODO_NOT_ARCHIVED' using errcode='22023'; end if;
  update public.todo_items set done=false,archived=false where id=v_item.id or (parent_id=v_item.id and owner_user_id=v_owner);
 elsif p_action='clear_archive' then
  update public.todo_items set deleted=true where owner_user_id=v_owner and parent_id in
   (select id from public.todo_items where owner_user_id=v_owner and parent_id is null and archived and not deleted);
  update public.todo_items set deleted=true where owner_user_id=v_owner and parent_id is null and archived and not deleted;
 else raise exception 'INVALID_TODO_ACTION' using errcode='22023'; end if;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,after_snapshot)
 values(v_owner,'todo',coalesce(p_id,v_owner),p_action,jsonb_build_object('title',p_title,'done',p_done));
end $$;
revoke all on function public.write_todo(text,uuid,text,uuid,boolean) from public,anon;
grant execute on function public.write_todo(text,uuid,text,uuid,boolean) to authenticated;
