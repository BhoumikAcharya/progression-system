# Milestone 4 — Hobbies, Sleep, To-Dos and archives

## Implemented

- Hobby creation from Quests with independent schedules and effects for each subtask, and configurable one-time Finish effects (default INT +5). Hobbies can be edited, reordered, archived, restored, finished or deleted; deleting preserves reward history.
- Overdue hobby occurrences remain tied to their original scheduled date when moved to a new date. Recording uses the original occurrence identity, so rescheduling cannot issue a second award for the same slot. Newly added or rescheduled steps start from the appropriate effective quest day.
- One-level Quick To-Dos with parent/child completion, automatic inline archive, restore that clears children, and confirmation before Clear Archive. To-Dos never create reward events.
- Shared sleep-night check-in from Quests, Sleep Log and Calendar. The same record and versioned correction RPC supplies all three views; future nights are rejected.
- Quest and Hobby archive/restore/delete actions through audited RPCs, with completed one-time quests view-only and finished hobbies permanent. Direct client writes to these activity tables were revoked.
- Online writes fail visibly; the no-credentials local preview does not pretend to save activities.

## Verification

- `npm run check`: lint, strict TypeScript, 31 unit tests, embedded PostgreSQL migrations and transaction smoke test, production build.
- `npm run test:e2e`: 40 phone/iPad browser checks passed in Inked Fantasy and OLED Black.
- Database checks cover To-Do nesting and archive, zero To-Do XP, hobby edit history, duplicate subtask and Finish awards, overdue reschedule identity, lifecycle transitions, owner isolation and direct-write denial.

## Remaining work

- Live private Supabase testing with two authenticated sessions has not been run. There are no project credentials in this repository; the local URL is a preview until connected.
- Calendar stat history, historical correction/edit screens, the morning report and account-synced appearance settings remain for later milestones.
- A hobby schedule edit changes pending dates from the edit day onward. Earlier recorded rewards stay in the ledger; a complete historical schedule-period browser is future work.
- PWA installation and production deployment are not enabled. Hostinger remains untouched.
