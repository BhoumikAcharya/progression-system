-- Progression System v1. Apply only to a private Supabase project after review.
-- Public signup must be disabled in Supabase Auth settings; provision one owner manually.
create extension if not exists pgcrypto;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create type public.theme_id as enum ('inked-fantasy','oled-black');
create type public.quest_type as enum ('standard','volatile','routine');
create type public.lifecycle as enum ('active','archived','finished','deleted');
create type public.sleep_category as enum ('EARLY','MIDDLE','LATE');

create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Player' check (length(btrim(display_name)) between 1 and 60),
 time_zone text not null default 'Asia/Kolkata',
 theme public.theme_id not null default 'inked-fantasy',
 corrected_lifetime_xp bigint not null default 0 check (corrected_lifetime_xp>=0),
 highest_level_achieved integer not null default 1 check (highest_level_achieved>=1),
 stats jsonb not null default '{"STR":0,"INT":0,"VIT":0,"DIS":0,"BNK":0}'::jsonb,
 last_report_seen_quest_day date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint stats_shape check (jsonb_typeof(stats)='object' and stats ?& array['STR','INT','VIT','DIS','BNK'])
);
create table public.quest_definitions (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id),
 type public.quest_type not null, name text not null check (length(btrim(name)) between 1 and 200), description text,
 schedule_spec jsonb not null, effects jsonb not null default '{}'::jsonb, state public.lifecycle not null default 'active', version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint quest_state check (state in ('active','archived','deleted')),
 constraint schedule_kind check (schedule_spec->>'kind' in ('DAILY','WEEKDAYS','MONTHLY','YEARLY','ONCE')),
 unique(id,owner_user_id)
);
create table public.quest_schedule_periods (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null,
 quest_id uuid not null, generation integer not null check(generation>0),
 active_from date not null, active_through date, schedule_spec jsonb not null,
 foreign key(quest_id,owner_user_id) references public.quest_definitions(id,owner_user_id),
 unique(quest_id,generation), check(active_through is null or active_through>=active_from)
);
create table public.quest_outcomes (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null,
 quest_id uuid not null, slot smallint not null check(slot in (1,2)), label text not null,
 effects jsonb not null default '{}'::jsonb, version integer not null default 1,
 foreign key(quest_id,owner_user_id) references public.quest_definitions(id,owner_user_id), unique(quest_id,slot)
);
create table public.routine_steps (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null,
 quest_id uuid not null, name text not null, ordinal integer not null,
 foreign key(quest_id,owner_user_id) references public.quest_definitions(id,owner_user_id), unique(quest_id,ordinal)
);
create table public.quest_occurrences (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null,
 quest_id uuid not null, period_id uuid not null references public.quest_schedule_periods(id),
 scheduled_date date not null, actual_activity_date date,
 status text not null default 'unreported' check(status in ('unreported','partial','completed')),
 selected_outcome_id uuid references public.quest_outcomes(id), version integer not null default 1 check(version>0),
 recorded_at timestamptz, updated_at timestamptz not null default now(),
 foreign key(quest_id,owner_user_id) references public.quest_definitions(id,owner_user_id),
 unique(owner_user_id,quest_id,scheduled_date)
);
create table public.routine_step_completions (
 owner_user_id uuid not null, occurrence_id uuid not null references public.quest_occurrences(id),
 step_id uuid not null references public.routine_steps(id), completed_at timestamptz,
 primary key(occurrence_id,step_id)
);
create table public.hobbies (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id),
 name text not null, description text, state public.lifecycle not null default 'active',
 finish_effects jsonb not null default '{"INT":5}'::jsonb, version integer not null default 1,
 finished_at timestamptz, created_at timestamptz not null default now(), unique(id,owner_user_id)
);
create table public.hobby_steps (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null, hobby_id uuid not null,
 name text not null, schedule_spec jsonb not null, effects jsonb not null default '{}'::jsonb,
 ordinal integer not null, version integer not null default 1, state public.lifecycle not null default 'active',
 foreign key(hobby_id,owner_user_id) references public.hobbies(id,owner_user_id), unique(id,owner_user_id)
);
create table public.hobby_occurrences (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null, step_id uuid not null,
 scheduled_date date not null, actual_activity_date date, completed_at timestamptz, version integer not null default 1,
 foreign key(step_id,owner_user_id) references public.hobby_steps(id,owner_user_id),
 unique(owner_user_id,step_id,scheduled_date)
);
create table public.hobby_finish_awards (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null, hobby_id uuid not null,
 actual_activity_date date not null, awarded_at timestamptz not null default now(), effects_snapshot jsonb not null,
 foreign key(hobby_id,owner_user_id) references public.hobbies(id,owner_user_id), unique(owner_user_id,hobby_id)
);
create table public.sleep_records (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id),
 sleep_night_date date not null, category public.sleep_category not null,
 version integer not null default 1 check(version>0), recorded_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_user_id,sleep_night_date), unique(id,owner_user_id)
);
create table public.todo_items (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id),
 parent_id uuid references public.todo_items(id), title text not null, done boolean not null default false,
 archived boolean not null default false, deleted boolean not null default false, position integer not null default 0,
 created_at timestamptz not null default now(), unique(id,owner_user_id), check(parent_id is distinct from id)
);
create table public.reward_source_events (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id),
 source_type text not null check(source_type in ('quest','hobby','finish','sleep')),
 source_id uuid not null, revision integer not null check(revision>0),
 scheduled_date date, activity_date date not null,
 config_snapshot jsonb not null, raw_effects jsonb not null, streak_effects jsonb not null,
 valid boolean not null default true, recorded_at timestamptz not null default now(),
 unique(owner_user_id,source_type,source_id,revision)
);
create table public.stat_ledger_entries (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id),
 source_event_id uuid not null references public.reward_source_events(id), stat_key text not null check(stat_key in ('STR','INT','VIT','DIS','BNK')),
 raw_delta integer not null, streak_delta integer not null, effective_delta integer not null,
 activity_date date not null, recorded_at timestamptz not null default now(), unique(source_event_id,stat_key)
);
create table public.xp_ledger_entries (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id),
 source_event_id uuid not null references public.reward_source_events(id), credit_delta bigint not null,
 activity_date date not null, reason text not null,
 recorded_at timestamptz not null default now(), unique(source_event_id,reason)
);
create table public.streak_states (
 owner_user_id uuid not null references public.profiles(user_id), quest_id uuid not null,
 outcome_id uuid, generation integer not null, current_length integer not null default 0 check(current_length>=0),
 last_scheduled_date date, primary key(owner_user_id,quest_id),
 foreign key(quest_id,owner_user_id) references public.quest_definitions(id,owner_user_id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(user_id),
 target_type text not null, target_id uuid not null, change_type text not null,
 before_snapshot jsonb, after_snapshot jsonb, recorded_at timestamptz not null default now()
);

-- All public tables are owner-filtered; policy never uses a client-supplied owner as authority.
do $$ declare t text; begin
 foreach t in array array['profiles','quest_definitions','quest_schedule_periods','quest_outcomes','routine_steps','quest_occurrences','routine_step_completions','hobbies','hobby_steps','hobby_occurrences','hobby_finish_awards','sleep_records','todo_items','reward_source_events','stat_ledger_entries','xp_ledger_entries','streak_states','audit_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_select on public.%I for select to authenticated using (%I = auth.uid())',t,case when t='profiles' then 'user_id' else 'owner_user_id' end);
 end loop;
end $$;
-- Only ordinary configuration rows may be directly authored. Reward and projection tables are RPC-only.
create policy profile_insert on public.profiles for insert to authenticated with check(user_id=auth.uid());
create policy profile_update on public.profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy quest_insert on public.quest_definitions for insert to authenticated with check(owner_user_id=auth.uid());
create policy quest_update on public.quest_definitions for update to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
create policy hobby_insert on public.hobbies for insert to authenticated with check(owner_user_id=auth.uid());
create policy hobby_update on public.hobbies for update to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
create policy todo_insert on public.todo_items for insert to authenticated with check(owner_user_id=auth.uid());
create policy todo_update on public.todo_items for update to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
create policy todo_delete on public.todo_items for delete to authenticated using(owner_user_id=auth.uid());

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert(user_id,display_name,time_zone,theme) on public.profiles to authenticated;
grant update(display_name,theme) on public.profiles to authenticated;
grant insert(owner_user_id,type,name,description,schedule_spec,effects,state) on public.quest_definitions to authenticated;
grant update(name,description,schedule_spec,effects,state,version,updated_at) on public.quest_definitions to authenticated;
grant insert(owner_user_id,name,description,state,finish_effects) on public.hobbies to authenticated;
grant update(name,description,state,finish_effects,version) on public.hobbies to authenticated;
grant insert(owner_user_id,parent_id,title,done,archived,position) on public.todo_items to authenticated;
grant update(title,done,archived,deleted,position) on public.todo_items to authenticated;
grant delete on public.todo_items to authenticated;
