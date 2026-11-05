-- Archive removal changes only visibility. Source records and earned history stay intact.
create table public.archive_hidden_entries (
 owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 entry_kind text not null check(entry_kind in
  ('quest_definition','hobby_definition','quest_completion','hobby_completion')),
 entry_id uuid not null,
 removed_at timestamptz not null default now(),
 primary key(owner_user_id,entry_kind,entry_id)
);
alter table public.archive_hidden_entries enable row level security;
create policy owner_select on public.archive_hidden_entries for select to authenticated
 using(owner_user_id=auth.uid());
revoke all on public.archive_hidden_entries from anon,authenticated;
grant select on public.archive_hidden_entries to authenticated;

create or replace function public.remove_archive_entry(p_kind text,p_entry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_exists boolean:=false;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_entry_id is null then raise exception 'ENTRY_ID_REQUIRED' using errcode='22023'; end if;
 case p_kind
 when 'quest_definition' then
  select exists(select 1 from public.quest_definitions
   where id=p_entry_id and owner_user_id=v_owner and state='archived') into v_exists;
 when 'hobby_definition' then
  select exists(select 1 from public.hobbies
   where id=p_entry_id and owner_user_id=v_owner and state in ('archived','finished')) into v_exists;
 when 'quest_completion','hobby_completion' then
  select exists(select 1 from public.reward_source_events
   where source_id=p_entry_id and owner_user_id=v_owner and valid=true and
    source_type=case when p_kind='quest_completion' then 'quest' else 'hobby' end) into v_exists;
 else raise exception 'INVALID_ARCHIVE_KIND' using errcode='22023';
 end case;
 if not v_exists then raise exception 'ARCHIVE_ENTRY_NOT_FOUND' using errcode='22023'; end if;
 insert into public.archive_hidden_entries(owner_user_id,entry_kind,entry_id)
  values(v_owner,p_kind,p_entry_id) on conflict do nothing;
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type)
  values(v_owner,'archive_entry',p_entry_id,'removed_from_archive');
end $$;
revoke all on function public.remove_archive_entry(text,uuid) from public,anon;
grant execute on function public.remove_archive_entry(text,uuid) to authenticated;

create or replace function public.remove_archived_todo(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_item public.todo_items%rowtype;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
 select * into v_item from public.todo_items where id=p_id and owner_user_id=v_owner
  and parent_id is null and archived and not deleted for update;
 if not found then raise exception 'ARCHIVED_TODO_NOT_FOUND' using errcode='22023'; end if;
 update public.todo_items set deleted=true where owner_user_id=v_owner
  and (id=p_id or parent_id=p_id);
 insert into public.audit_events(owner_user_id,target_type,target_id,change_type,before_snapshot)
  values(v_owner,'todo',p_id,'removed_from_archive',to_jsonb(v_item));
end $$;
revoke all on function public.remove_archived_todo(uuid) from public,anon;
grant execute on function public.remove_archived_todo(uuid) to authenticated;

-- Include archive visibility in full owner exports.
create or replace function public.export_private_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid:=auth.uid(); v_table text; v_rows jsonb; v_data jsonb:='{}'::jsonb;
begin
 if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not exists(select 1 from public.profiles where user_id=v_owner) then
  raise exception 'Profile unavailable' using errcode='42501'; end if;
 foreach v_table in array array[
  'profiles','quest_definitions','quest_schedule_periods','quest_outcomes',
  'routine_steps','quest_occurrences','routine_step_completions',
  'hobbies','hobby_steps','hobby_occurrences','hobby_finish_awards',
  'hobby_reschedules','sleep_records','todo_items','reward_source_events',
  'stat_ledger_entries','xp_ledger_entries','streak_states','audit_events',
  'archive_hidden_entries'
 ] loop
  execute format(
   'select coalesce(jsonb_agg(to_jsonb(row_data)), ''[]''::jsonb) from public.%I row_data where %I=$1',
   v_table, case when v_table='profiles' then 'user_id' else 'owner_user_id' end
  ) into v_rows using v_owner;
  v_data:=v_data||jsonb_build_object(v_table,v_rows);
 end loop;
 return jsonb_build_object('schema_version',1,'exported_at',transaction_timestamp(),
  'account_user_id',v_owner,'tables',v_data);
end $$;
revoke all on function public.export_private_data() from public,anon;
grant execute on function public.export_private_data() to authenticated;
