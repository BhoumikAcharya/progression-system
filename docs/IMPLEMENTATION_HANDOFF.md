# Progression System — implementation handoff

**Status as of 2026-11-06:** The six implementation milestones are represented in the working tree. The app builds and runs locally against the **development** Supabase project. Automated local, browser, and live development-database checks have passed. A Vercel project has been imported, but its first deployment is an **unconnected preview build** and direct `/status` requests return 404. The fix in this checkout is pending commit/push and Vercel environment setup. **No production Supabase project has been set up.** This is ready for a controlled private beta after the release gates below, not yet a verified production release.

This file is the current-status map for future coding agents. Product behavior is governed by `AGENTS.md`, then `docs/DECISIONS.md` and `docs/PROGRESSION_RULES.md`; this file does not override them. `MILESTONE_1.md` through `MILESTONE_6.md`, `INTEGRATION_READINESS.md`, and parts of `README.md` are historical snapshots and contain statements that were true before the development project was connected.

## Architecture and implementation

- **Frontend:** React 19, strict TypeScript, Vite, React Router, Tailwind with semantic CSS tokens. One component tree supports Inked Fantasy (default) and OLED Black. Phone navigation has six destinations: Status, Quests, To-Dos, Calendar, Hobbies, Hub. Quests and Calendar use wider master/detail layouts on iPad. The Morning System Report is fullscreen.
- **Domain:** Pure utilities in `src/domain/` handle XP/levels, stat floors, sleep rules, streaks, real calendar dates, 03:00 account-local quest days, recurrence, and history summaries. Do not derive progression rules from design mockups.
- **Data:** `src/data/supabase.ts` creates the browser client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Supabase Auth gates private routes. PostgreSQL migrations in `supabase/migrations/` provide owner-scoped tables, RLS, audited ledgers, unique occurrences, and transactional RPCs for recording and correcting awards. The browser does not write XP totals directly. Quest creation has a stable request ID and server-side idempotency.
- **Activity flows:** Standard, Volatile, Routine, and Hobby / Project creation; scheduled completion and correction; hobby subtasks, archive/restore/finish; one-level To-Dos and inline archive; shared sleep-night entry from Quests, Sleep Log, and Calendar; Calendar history and Morning Report; account profile/theme settings; authenticated JSON export.
- **PWA:** Manifest, icons, production service worker, online-first app shell. Offline activity writes fail visibly and are not queued. The service worker does not cache Supabase responses.
- **Local configuration:** Copy `.env.example` to Git-ignored `.env.local`; use only the project URL and **publishable** key. `.env.live-test.local` holds two test-account credentials for `npm run test:live` and is also Git-ignored. Never place a database password, secret/service-role key, or personal test credentials in Git or a `VITE_` variable.

## Recent user-reported bugs and fixes

| Report | Implemented fix and regression coverage |
| --- | --- |
| Save Quest looked delayed and repeated taps produced duplicate quests. | `QuestEditor` blocks an in-flight submit and reuses a stored creation request ID on retry. Migration `202611060001_idempotent_quest_creation.sql` makes repeated requests return the same quest. Connected browser and embedded-Postgres tests cover uncertain response/retry. |
| Daily quests required a refresh; Once quests seemed to disappear. | `QuestList` reloads on route change, classifies due quests from schedule periods, and shows active future/non-due quests immediately in **Not due today** with next due date and management actions. The editor rejects a past one-time date. Tests cover Daily, Once, Weekdays, Monthly, Yearly, Standard, Volatile, Routine, and a Hobby / Project save path. |
| Quest, Hobby, and To-Do Archives looked limited to one day. | Quest/Hobby completion history queries valid award events across **all dates**, including definitions later archived/deleted. To-Do Archive shows all completed roots with their children. |
| Archive entries needed a right-side removal action. | Migration `202611060002_archive_visibility.sql` adds owner-scoped hidden-entry markers and removal RPCs. Quest/Hobby **Remove** hides the selected definition or completion from its archive list while retaining the underlying private record, earned stats/XP, Calendar history, audit trail, and JSON export. Archived To-Dos are soft-deleted with their children; they have no progression award. Browser, database, and two-account live tests cover this. |
| Sleep Check-In took too much space. | Hub → Settings now has a device-persistent **Collapsed by default** toggle. The check-in can still be expanded. Connected browser test covers persistence. |
| Editor dividers were doubled; Hobbies briefly flashed stale tasks. | CSS editor rows were normalized. Hobbies clears stale results while a fresh load is pending; connected browser test covers the flash. |

## Verified development state

The only linked live project used for integration checks is `progression-system-dev` (`jtrvzbkklpiuwydaolek`). Migrations through `202611060002_archive_visibility.sql` were previewed for that exact project and applied there. The CLI calls its main branch `production`; that label does **not** mean this is the application's production database.

Latest recorded results:

- `npm run check` — passed: lint, strict typecheck, 40 Vitest tests, embedded PostgreSQL migration/transaction/RLS checks, and Vite build.
- `npm run test:e2e` — 52 passed across phone/iPad and both themes. The preview suite runs on isolated port 5175 so an authenticated local server on 5173 cannot affect it.
- `npm run test:connected` — 4 passed using mocked Supabase responses, including save visibility/schedule matrix, archive removal persistence, preferences, and Hobby loading.
- `npm run test:live` — 10 passed against the development project using two private test accounts: auth, owner isolation, idempotent creation, concurrent completion, second-device sync, archive visibility/RLS, correction, JSON export, and isolated in-memory recovery.
- `npm run test:pwa` — 1 passed after isolating its **unconfigured production** build from `.env.local`; verifies the offline shell remains closed when sign-in settings are missing. `npm run format:check` passed.

The build has a nonblocking large-chunk warning. No claim is made that these tests prove performance under a large history or Safari/iPadOS installation behavior.

## Concerns and remaining work before release

1. **Commit state:** The Vercel routing and fail-closed configuration fix is currently uncommitted. Review the diff, keep `.env*` and generated test artifacts out, and push the fix before testing the next hosted build.
2. **Intermittent live loading:** A prior local browser session briefly showed “Could not load quests” while retaining old cards. The UI now clears stale results and surfaces the actual server error with Retry; the underlying intermittent cause was not reproduced in automated tests. Capture the real error/network response if it returns. Verify immediate saves on real phone/iPad browsers.
3. **Creation hardening:** The UI rejects past Once dates; the server `create_quest_once` RPC does not yet enforce that date rule. Hobby creation does not yet have the same request-ID idempotency as quest creation, so an uncertain network response followed by a retry deserves a separate regression and server safeguard.
4. **Backups:** JSON export is owner-filtered and was checked with isolated in-memory recovery. There is **no in-app JSON import** and no verified production database backup schedule or full hosted restore drill. Follow `BACKUP_AND_RECOVERY.md` before storing irreplaceable data.
5. **Production/security setup:** Provision a separate production Supabase project if releasing beyond development testing; apply and verify the complete migration set, RLS, signup policy, owner account, redirect configuration, backup/restore process, and two-account isolation. Do not point a public deployment at the current development project by accident.
6. **Device/hosting checks:** Test actual iPhone Safari and iPad Safari PWA install, login/session refresh, 03:00 rollover, offline recovery, and direct loading of nested routes over HTTPS. The connected production PWA path has not been device-tested. Public self-signup is outside private single-user v1; any tester accounts should be provisioned deliberately.

## Suggested publishing sequence

Vercel can host this Vite SPA; Hostinger is also possible. A Vercel project has been created at `progression-system-olive.vercel.app`, but its first deployment is not connected to Supabase. First decide whether the next working deployment is a **private staging beta** or a production release. Keep the Supabase project/environment for each explicit, then:

1. Commit and run all gates above from a clean checkout.
2. For Vercel, use framework **Vite**, build command `npm run build`, and output directory `dist`. `vercel.json` in this checkout supplies the SPA rewrite so direct links such as `/quests/new` load. See [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite).
3. Configure **exactly** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the intended environment in Vercel Project Settings → Environment Variables. The Vercel Supabase integration supplies `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, which this Vite app does not read automatically. These are browser-public values; never add secret/service-role keys to `VITE_` variables. Verify the URL points to the same project as the intended test accounts, then rebuild/redeploy after changing variables.
4. Set the matching Supabase Auth Site URL and exact production redirect URL(s); retain localhost redirects for development as needed. See [Supabase redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls).
5. Deploy a preview, test sign-in and each primary workflow with disposable accounts, verify RLS and backup, then approve the production promotion. Do not migrate test-account data casually.

For a personal noncommercial project, Vercel's Hobby plan may fit; [Vercel restricts Hobby to personal noncommercial use](https://vercel.com/docs/plans/hobby). Confirm the current terms and expected usage before choosing a plan. Hosting serves the frontend; Supabase remains the database and authentication service.
