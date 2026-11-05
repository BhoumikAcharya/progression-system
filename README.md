# Progression System

A private, mobile-first PWA for tracking real-life progression. **Default theme: Inked Fantasy. Alternate theme: OLED Black.** The application source, database migrations, tests, product requirements, and original design references are in this repository.

**Current implementation and release handoff:** [docs/IMPLEMENTATION_HANDOFF.md](docs/IMPLEMENTATION_HANDOFF.md). The milestone sections below record earlier checkpoints and may describe work that has since been completed.

## For future coding agents

1. Read [the current implementation handoff](docs/IMPLEMENTATION_HANDOFF.md) for completed work, verified checks, current risks, and the publishing sequence.
2. Follow `AGENTS.md` and the product source-of-truth order below before changing behavior or UI. Preserve the two original `design/*` references.
3. Keep `.env.local` and `.env.live-test.local` private and Git-ignored. Use `.env.example` for public client configuration names only.
4. Review the existing uncommitted implementation before creating commits or deploying it.

## Authority order in conflicts

1. `docs/DECISIONS.md` — deliberate product choices and implementation defaults (highest priority after user instructions).
2. `docs/PROGRESSION_RULES.md` — calculations, recurrence, correction semantics and invariants.
3. `docs/PRD.md`, `docs/USER_FLOWS.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md` — feature behavior and engineering constraints.
4. `docs/DESIGN_SYSTEM.md` and `design/*/design-spec.md` — visual styles, responsive patterns.
5. `design/**/*.html` / `*.png` — static, **non-functional** visual examples only.

Mockup sample dates, XP totals and page labels contain known mistakes. Implement the formulas and data in the written rules, **not** the illustrative numbers in screenshots. In particular, the Level 7 → 8 XP requirement is **929**, not 927, and Wednesday, 4 November 2026 was **Wednesday**, not Tuesday.

## Product and boundaries

- Six destinations, ordered: **Status, Quests, To-Dos, Calendar, Hobbies, Hub**.
- Four quest creation types: **Standard, Volatile, Routine, Hobby/Project**.
- Sleep is a built-in fixed-rules feature, accessible in Quests and Hub > Sleep Log.
- Stats: STR, INT, VIT, DIS, BNK; Energy is a separate text-only daily condition.
- Daily quest rollover at **03:00 in account time zone (`Asia/Kolkata` initially)**; sleep-night attribution is independent.
- One user initially, but server-enforced ownership on every record.
- Offline-first editing, device sensors, payments, full expense ledger, media tracking, HP/MP, ranks, and global streaks are **out of scope**.

## Current architecture decision

React + TypeScript + Vite, Tailwind + semantic CSS tokens, Supabase (PostgreSQL + Auth + Row Level Security), installable online-first PWA, Vitest and Playwright. Host on Hostinger Business later; production rollout, custom domain and secrets are not this handoff's first milestone.

## Reading order

- `docs/DECISIONS.md` — open topics now resolved as implementation defaults; **user may amend** before coding.
- `docs/PRD.md` — complete product scope and acceptance criteria.
- `docs/PROGRESSION_RULES.md` — single source of mathematical truth.
- `docs/DATA_MODEL.md` — relational model and audit requirements.
- `docs/ARCHITECTURE.md` — software boundaries, auth, reliability, time zones, storage.
- `docs/USER_FLOWS.md` — UI behavior, screens, navigation, editing, archives.
- `docs/DESIGN_SYSTEM.md` — both design philosophies, screen layout, interaction conventions.
- `docs/ACCEPTANCE_TESTS.md` — cases Codex must implement as repeatable tests.
- `design/` — exact user-supplied references from a separate design agent, **unaltered**.


## Local development — Milestone 1

Application source now lives in `src/`. The original handoff and reference designs above remain authoritative and unmodified.

Requires Node.js 22.12+ (or 24 LTS) and npm. No Supabase credentials are required.

```sh
npm ci
npm run dev
```

Open the Vite URL printed in the terminal (normally http://localhost:5173). To preview on a phone or iPad on the same network, use your computer's LAN address with port 5173. The dev server listens on all interfaces for that purpose. This is an empty local UI preview; do not use it to store private activity data.

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

Playwright starts its own Vite server and checks phone/iPad layouts in both themes. Review screenshots are saved under `test-results/`; the HTML report is in `playwright-report/`. These generated folders are ignored by Git. Screenshots are review artifacts, not approved pixel baselines yet.

### Foundation boundaries

- `src/app/`: real browser routes, shell, fail-closed private-route placeholder, preferences context.
- `src/components/`: shared navigation primitives, stat row, dividers, segmented controls.
- `src/features/`: six destinations and supporting Hub routes; real calendar browsing and local profile-name setup.
- `src/themes/`: semantic CSS tokens and replaceable local theme preference cache. Inked Fantasy is the default.
- `src/domain/`: typed entities, transition costs and explicit progression/scheduling contracts for Milestone 2.
- `src/data/`: preference storage adapter and future auth/repository contracts. There is no activity write or client-authored XP API.

Only the theme and preview name persist in browser storage. Settings truthfully reports local persistence and lack of sync. Storage failures degrade to session-only preferences. `/private/*` redirects to the authentication placeholder; this does **not** constitute production authentication or RLS. The ordinary routes deliberately show only an empty preview and do not load any private account data.

Quest/sleep/To-Do/hobby creation, rewards, history, real authentication, export, full-screen reports, and cross-device sync are intentionally deferred. PWA installation, service-worker caching and production deployment are not enabled in this milestone. Refreshing any browser route works through Vite's SPA fallback; the eventual host must also supply an SPA fallback.

Do not populate production credentials yet. `.env.example` reserves public Supabase settings for Milestone 2. Never put a service-role key in a `VITE_` variable.

## Milestone 2 local domain/database checks

Run `npm run test:db` for embedded PostgreSQL migration and transaction checks, or `npm run check` for the full unit, database, type, lint and build gate. See `MILESTONE_2.md` for scope and the remaining two-session Supabase gate. The UI remains a local preview until authenticated data access is connected.

## Milestone 3 local quest workflow

The quest editor supports Standard, Volatile and Routine drafts. With a connected Supabase project and signed-in user, the editor saves through `create_quest`; the Quests screen records Standard and Volatile outcomes and Routine steps through server transactions. Status reads server-owned totals. Apply all migrations in `supabase/migrations/` to the connected project before using those flows. Only public URL and publishable key belong in `.env.local` (see `.env.example`); never put a service-role key in the frontend.

Without Supabase settings, the app remains a useful local layout preview. Quest drafts are not saved, and the editor says so when Save is pressed. Hobby creation and the other activity screens remain for subsequent milestones. Run `npm run check` and `npm run test:e2e` to verify this milestone locally. See [MILESTONE_3.md](MILESTONE_3.md) for completed scope and remaining integration checks.

## Milestone 4 local activity workflows

Hobbies, To-Dos and Sleep Log now have authenticated server-backed workflows. Hobbies support independently rewarded scheduled subtasks, editing, reordering, overdue rescheduling, Archive/Restore/Delete and a one-time Finish reward. To-Dos support one-level checklists and an inline archive without stats or XP. Quests, Sleep Log and Calendar use the same sleep-night record. Quest and Hobby archives are connected to server state. See [MILESTONE_4.md](MILESTONE_4.md) for the implementation and validation summary.

The open local Vite preview does not contain an authenticated account. To exercise saves, use a private Supabase project with migrations `202611050001` through `202611050014` applied and add its public URL and publishable key to `.env.local`. Do not use a service-role key. No Hostinger deployment has been performed.

## Milestone 5 Calendar and report

Calendar now reads recorded history and supports versioned corrections to quest, hobby subtask and Finish awards. The fullscreen Morning Report is claimed once per account quest day after 03:00, and any past date can be opened manually from Calendar. See [MILESTONE_5.md](MILESTONE_5.md) for tested behavior and live integration limits. A connected project needs all migrations through `202611050018`; the unconnected local preview remains read-only for private activity.

## Milestone 6 export and installability

Apply migration `202611050019` before using **Settings → Download JSON backup** with a connected account. The export is owner-filtered, versioned, and downloaded directly to your device; JSON import is not available. See [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) for backup and recovery limits.

The production build has an install manifest and online-first service worker. To check the production shell locally, run `npm run test:pwa`; to preview it manually, run `npm run build` then `npm run preview`. The Vite development server intentionally does not register a service worker. Offline reopening of the shell does not mean private records or edits are available offline. See [MILESTONE_6.md](MILESTONE_6.md) for validation and remaining device/live-project checks.

## Connected-account readiness — historical checkpoint

With a signed-in account, name and theme load from the server; Settings saves each field independently and provides sign-out. `npm run test:connected` exercises the route and preference flow against mocked Supabase responses. The later development-project live checks and remaining production gates are recorded in [the current implementation handoff](docs/IMPLEMENTATION_HANDOFF.md).
