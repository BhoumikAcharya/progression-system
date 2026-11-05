# Milestone 3 — Quest creation and daily recording

## Implemented

- Shared quest editor for Standard, Volatile and Routine with schedule controls, stat effects, outcome labels, routine steps and XP preview. Hobby remains visibly deferred to Milestone 4.
- Authenticated `create_quest` transaction for definitions, schedule periods, outcomes or steps. The server validates effects and schedule, and checks ownership.
- Authenticated daily quest list, current occurrence state, recorded reward summary, and atomic Standard/Volatile recording.
- Authenticated `record_routine_step` transaction. A Routine earns its parent reward once, after all steps are complete. Duplicate step calls are idempotent.
- Status reads server profile, stat and XP totals when connected. A no-credentials local preview stays empty and explicitly refuses unsaved quest writes.
- Phone and iPad browser coverage for editor states in both themes.

## Validation

- `npm run format`
- `npm run check` — lint, typecheck, 31 unit tests, embedded PostgreSQL migration/transaction smoke test, production build passed.
- `npm run test:e2e` — 32 Playwright checks passed across phone/iPad and Inked/OLED.

## Still to do

- Live Supabase integration with two authenticated sessions and actual network/realtime behavior has not been run; no project credentials are available in the repository. Apply migrations before connecting a project.
- Quest correction, editing, archiving, delete/history UI and past-day reporting are later work. Server-side correction and reconciliation foundations are already in Milestone 2.
- Hobby/Project, To-Dos, sleep recording UI, Calendar activity data and report screens remain in later milestones.
- Account settings still keep theme/name preferences on the current device; profile synchronization remains pending.
