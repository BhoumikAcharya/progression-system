-- Authenticated, single-statement snapshot of all owner records. Keep the table list
-- explicit so new tables require an intentional export schema revision.
create or replace function public.export_private_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
 v_owner uuid := auth.uid();
 v_table text;
 v_rows jsonb;
 v_data jsonb := '{}'::jsonb;
begin
 if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not exists (select 1 from public.profiles where user_id=v_owner) then
  raise exception 'Profile unavailable' using errcode='42501';
 end if;
 foreach v_table in array array[
  'profiles','quest_definitions','quest_schedule_periods','quest_outcomes',
  'routine_steps','quest_occurrences','routine_step_completions',
  'hobbies','hobby_steps','hobby_occurrences','hobby_finish_awards',
  'hobby_reschedules','sleep_records','todo_items','reward_source_events',
  'stat_ledger_entries','xp_ledger_entries','streak_states','audit_events'
 ] loop
  execute format(
   'select coalesce(jsonb_agg(to_jsonb(row_data)), ''[]''::jsonb) from public.%I row_data where %I=$1',
   v_table, case when v_table='profiles' then 'user_id' else 'owner_user_id' end
  ) into v_rows using v_owner;
  v_data := v_data || jsonb_build_object(v_table,v_rows);
 end loop;
 return jsonb_build_object(
  'schema_version',1,
  'exported_at',transaction_timestamp(),
  'account_user_id',v_owner,
  'tables',v_data
 );
end $$;
revoke all on function public.export_private_data() from public,anon;
grant execute on function public.export_private_data() to authenticated;
