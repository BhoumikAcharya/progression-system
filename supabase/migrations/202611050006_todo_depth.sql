-- Protect the unscored one-level To-Do hierarchy at the database boundary.
create or replace function app_private.check_todo_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_parent public.todo_items%rowtype;
begin
 if new.parent_id is null then return new; end if;
 select * into v_parent from public.todo_items where id=new.parent_id;
 if not found or v_parent.owner_user_id<>new.owner_user_id or v_parent.parent_id is not null then
  raise exception 'INVALID_TODO_PARENT' using errcode='23514';
 end if;
 if exists(select 1 from public.todo_items where parent_id=new.id) then
  raise exception 'TODO_HAS_CHILDREN' using errcode='23514';
 end if;
 return new;
end $$;
create trigger check_todo_parent before insert or update of parent_id,owner_user_id
 on public.todo_items for each row execute function app_private.check_todo_parent();
revoke all on function app_private.check_todo_parent() from public,anon,authenticated;
