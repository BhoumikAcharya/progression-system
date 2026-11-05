# Progression System — Codex Handoff (v1)

A private, mobile-first PWA for tracking real-life progression. **Default theme: Inked Fantasy. Alternate theme: OLED Black.** This repository starter contains *instructions, product requirements, historical rule decisions, technical plans, tests, and the original design agent's reference assets*. It is **not the application source code**; Codex will scaffold that.

## What to give Codex

1. Put the **contents** of this folder in the root of a new private GitHub repository.
2. In Codex, open that repository. Ask it to read `AGENTS.md`, `docs/DECISIONS.md`, `docs/PRD.md`, `docs/PROGRESSION_RULES.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/USER_FLOWS.md`, `docs/DESIGN_SYSTEM.md`, `docs/ACCEPTANCE_TESTS.md`, and the two `design/*/design-spec.md` files **before editing code**.
3. Start with `prompts/CODEX_START.md`. Let Codex implement milestone by milestone; run tests and inspect on a phone-sized viewport after each milestone.
4. Never commit credentials. Create `.env.local` using `.env.example` once Codex scaffolds the project. Deployment is deliberately deferred.

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
