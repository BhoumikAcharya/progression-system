# Milestone 2 — Domain and data foundation

Milestone 1 received UX review. This milestone adds the progression rules and a locally tested PostgreSQL schema and transaction foundation. The running UI is still an empty preview until the authenticated data path is integrated and the two-session database gate is satisfied.

## Work completed

- `src/domain/progression/`: stat floor, positive-only XP, cumulative level thresholds and monotonic unlock, ordered replay after correction, daily summaries, scheduled and Volatile streak projection, no retroactive bonus creation, fixed sleep effects and next-day Energy.
- `src/domain/scheduling/`: account-zone 03:00 quest day, separate calendar date, real weekday and leap-date recurrence, stable occurrence keys and idempotent pure missed-day discovery.
- `supabase/migrations/`: owner-scoped profiles, quest periods/outcomes/occurrences, hobbies, sleep, To-Dos, reward/stat/XP ledgers, audit and streak state. RLS on all user-owned tables; authenticated clients cannot write profile stats or XP totals directly. RPCs lock the profile, authorize `auth.uid()`, record Standard/Volatile quests and sleep once, reject stale correction, replay floor-dependent effects, preserve the highest level, reconcile missed due slots, and remove an incorrect quest completion with dependent bonus withdrawal. To-Do nesting is constrained to one child level.
- `src/data/supabase.ts`: lazy public-key Supabase client and auth/profile repository adapters. No credentials are required to run the local preview; the adapter is not yet wired into the UI.
- `supabase/tests/migration-smoke.mjs`: embedded PostgreSQL integration gate. README and CI now include it in `npm run check`.

## Validation

`npm run check` passed: ESLint, strict TypeScript, 31 Vitest tests across 9 files, embedded PostgreSQL migration/transaction checks, and a Vite production build. `npm run format:check` passed. The final npm install audit reported 0 vulnerabilities. No UI components changed, so the Milestone 1 phone/iPad browser suite was not repeated.

The database check applies all six migrations and tests anonymous denial, cross-owner isolation, blocked direct XP writes, idempotent quest and sleep recording, sleep/quest correction, level preservation, correction of a dependent streak bonus, 10 missed-day reconciliation with safe retry, historical backfill without bonus, and one-level To-Do nesting. It is one embedded PostgreSQL connection, so it does not prove a real two-session race. No Supabase project or Hostinger deployment was configured.

## Remaining before real records

Run the migrations and two authenticated-session race tests in an isolated Supabase/PostgreSQL instance. Implement the feature-specific Routine and Hobby transactions, full outcome/activity-date corrections, and UI authentication/data hooks in the next milestones. Preserve the current preview until those account operations are proven. The next product phase is Milestone 3: Standard, Volatile and Routine quest creation and recording through the validated server path, with loading, saved, conflict and offline states.
