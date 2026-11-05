# Suggested data model & transaction requirements

This is a starting relational architecture. Codex should produce actual reviewed PostgreSQL/Supabase migrations, not rely on this prose as executable SQL. Every user-owned table has `owner_user_id` tied to `auth.uid()` and RLS. For single-user v1, still enforce ownership boundaries.

## Core tables

| Table | Critical fields / constraints | Purpose |
|---|---|---|
| `profiles` | PK `user_id`; `display_name`; IANA `time_zone` (`Asia/Kolkata`); `theme` enum (`inked-fantasy` default / `oled-black`); `highest_level_achieved >= 1`; `last_report_seen_quest_day`; timestamps | Per-user settings and irreversible unlocks |
| `quest_definitions` | PK `id`, owner; `type` Standard/Volatile/Routine; name, description, `schedule_spec` JSON or normalized table; state Active/Archived/Deleted; `active_from`, `archived_at`, `version`; timestamps | Quest templates, not earned history |
| `quest_outcome_definitions` | PK; FK quest; `slot=1/2` unique per Volatile; custom label; signed five-stat effect JSON; version | Two configurable Volatile responses |
| `routine_steps` | PK; FK quest; name, ordinal, active flag | Parent routine step definitions |
| `quest_schedule_periods` | PK; FK quest; active start/end dates; schedule snapshot; generation id | Avoid scheduling during archive and accurately track schedule changes |
| `quest_occurrences` | PK; owner; FK quest; scheduled slot date; stable `occurrence_key`; `status` unreported/partial/completed; `selected_outcome_id`; `actual_activity_date`; timestamps; `version`; UNIQUE(owner,quest,occurrence_key) | Idempotent recurring/once-only reward identity |
| `routine_step_completions` | PK; FK occurrence, step; completed bool/time; UNIQUE(occurrence,step) | Completion progress per routine occurrence |
| `hobbies` | PK; owner, name, description; Active/Archived/Finished/Deleted; finish-effect config; `finished_at`; `version` | Long-term parent lifecycle |
| `hobby_steps` | PK; FK hobby; name, schedule spec, signed effects, ordinal, state, version | Individually scheduled rewarding subtasks |
| `hobby_occurrences` | PK; owner; step; scheduled date/key; actual date; status; version; UNIQUE(owner,step,occurrence_key) | Idempotent hobby subtask completions |
| `hobby_finish_awards` | PK, owner; FK hobby UNIQUE; awarded snapshot, actual date, awarded_at | Exactly-once finish award |
| `sleep_records` | PK; owner; `sleep_night_date`; `category` EARLY/MIDDLE/LATE; recorded_at/updated_at, version; UNIQUE(owner,sleep_night_date) | One sleep log across screens |
| `todo_items` | PK; owner; `parent_id` nullable FK self; title, done, position, archived status, deleted flag; enforce parent depth ≤1 | Single and nested unscored notes |
| `reward_source_events` | PK; owner; source_type (quest, hobby_occurrence, finish, sleep); source ID; config snapshot; scheduled date; actual attribution date; revision/version; record timestamp | Immutable evidence of granted/withdrawn configured reward |
| `stat_ledger_entries` | PK; owner; source event; stat key; raw delta, streak delta, effective applied delta, date; correction reference | Auditable signed stat effects and floor |
| `xp_ledger_entries` | PK; owner; source event; positive credit / compensating reversal; date, reason | Auditable corrected XP |
| `streak_states` | PK owner/quest/outcome; current length, last eligible occurrence, reset metadata | Current streak projection (not a global streak) |
| `audit_events` | PK; owner; target type/id; change type, before/after snapshot, recorded timestamp | Review history and correction integrity |

You may consolidate tables or use event sourcing differently if equivalent invariants and test coverage are maintained. Never store only mutable stat totals with no award provenance.

## Uniqueness and idempotency

- Quest occurrence: UNIQUE `(owner_user_id, quest_definition_id, occurrence_key)`.
- Hobby subtask: UNIQUE `(owner_user_id, hobby_step_id, occurrence_key)`.
- Sleep: UNIQUE `(owner_user_id, sleep_night_date)`.
- Hobby finish award: UNIQUE `(owner_user_id, hobby_id)`.
- Reward ledger source revisions unique so retries cannot credit twice.
- `version` checks on correction; stale writes rejected or reconciled explicitly.

## Reward application transaction

1. Authenticate owner and validate definition/current active schedule and intended occurrence.
2. Identify or create unique occurrence in a transaction; lock occurrence and relevant owner projections.
3. If same completion has already been recorded, return existing current state (idempotent).
4. Determine raw configured snapshot, streak status/bonus for on-time completion, actual attribution date; validate sign/allowed fields.
5. Create audit/source event; apply or compensate stat and XP entries in deterministic order; refresh owner totals and derived daily aggregates.
6. Update highest unlocked level *only upward*. Return authoritative calculated values and occurrence version. Commit atomically.

Corrections use the same server-authoritative transaction with previous event compensation, replay of floor-limited stat effects, streak dependency handling and version check. Avoid separate frontend `insert`, `update profiles`, `increment stat` calls.

## Date model

Use `timestamptz` for actual event timestamps; IANA time zone on profile; `date` for scheduled occurrence date, actual activity date, quest-day and sleep-night date. Never infer sleep night by just casting UTC timestamp to date. Avoid purely browser-time-based rollover; invalid dates and leap years need explicit tests.

## Derived views / aggregates

- Current displayed stat values from ordered ledger after stat floors.
- Corrected lifetime XP from currently valid XP credits/reversals.
- Highest Player Level as stored immutable upward projection.
- Calendar report for any actual activity date: effective gross gain, effective gross loss, net, XP, per-stat deltas, recorded outcomes. Distinguish no records vs recorded zero.
- Sleep Energy for next calendar day, derived from previous sleep night.
- Report dismissed marker per account quest-day, not per browser; when a report is reopened manually this does not change future auto-display eligibility.

## RLS tests / permissions

- A user sees/updates/deletes only their records.
- Non-authenticated user cannot read lifestyle history or user settings.
- Owner cannot forge `owner_user_id` to another user.
- Reward RPCs authorize `auth.uid()` and cannot be used to award arbitrary XP or exceed the configured snapshot.
- No public bucket URL for data exports; no credentials or privileged roles in frontend.
