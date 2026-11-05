# Milestone 5 — Calendar history and Morning Report

## Implemented

- Calendar day history reads server-owned stat and XP ledger events, quest occurrences, sleep nights, hobby subtask rewards and Finish rewards. Day details distinguish unreported activity, recorded zero, gains and losses. Phone uses a single detail view; iPad keeps month and detail side by side.
- Historical quest corrections use version-checked server transactions. An activity-date change replaces the award without doubling XP. An outcome change or removal compensates the old award and any dependent streak bonuses; backfill does not create retroactive streak bonuses. Historical Routine completion requires all steps.
- Historical hobby subtask and one-time Finish award corrections adjust the ledger and preserve the original occurrence identity. Removed subtasks can be recorded again exactly once.
- The fullscreen Morning Report summarizes the previous quest day after the 03:00 account-zone boundary. A server-side claim permits one automatic opening per account quest day. Calendar can reopen the report manually, and a historical correction updates its contents without generating a new automatic opening.
- Errors, stale versions and offline writes remain visible. The local preview with no Supabase settings does not claim to save activity.

## Verification

- `npm run format`, `npm run format:check`, `npm run check`, `npm run test:e2e` and `git diff --check` were run for this milestone. `npm run check` passed: lint, strict TypeScript, 33 unit tests, embedded PostgreSQL migration/transaction smoke tests through migration `202611050018`, and production build.
- Browser tests cover the manual Calendar-to-report route on phone and iPad in both themes, including hidden primary navigation and return to Status.
- Embedded PostgreSQL tests cover historical quest and hobby corrections, stale-version rejection, one claim per day, corrected streak/XP totals, historical Routine award and overlapping duplicate-award attempts.

## Remaining work

- The two-device collision test is an overlapping-call simulation against one embedded PGlite connection. It does not replace a live test with two authenticated Supabase sessions and independent database connections. No project credentials are in this repository.
- Live Supabase verification of auth/RLS, PostgREST relation reads, report claim across devices and concurrent writes remains required before relying on the connected app for personal data.
- Milestone 6 covers broader responsive and accessibility coverage, backup/export and PWA readiness. Production deployment remains separate.
