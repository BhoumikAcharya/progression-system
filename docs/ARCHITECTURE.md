# Engineering architecture

## Intent and scope

A private, mobile-first React/TypeScript/Vite PWA hosted eventually on Hostinger Business. Hosted Supabase PostgreSQL + Auth is the durable source of truth; no always-on custom Node server required in v1. This document is a code-design constraint, not deployment instructions. Do not block local coding on a domain, Hostinger credentials or production DNS.

## Proposed modules

```
src/
  app/                 routes, app shell, auth gates, screen transitions
  components/          checkbox, quest card, stat row, calendar cell, editors
  features/            status, quests, todos, calendar, hobbies, hub, sleep, reports
  domain/
    progression/       pure XP, stats, levels, streak logic
    scheduling/        quest-day time, recurrence and occurrence identity
    ledger/            event application and correction types
    types/             typed domain models and schemas
  data/                Supabase client, queries, RPC wrappers, repositories
  themes/              token values, theme selection, CSS variable binding
  hooks/               UI data hooks, loading/error/optimistic states
  assets/              app icons and logos developed during implementation
supabase/
  migrations/          reviewed SQL, constraints, RLS, RPC functions
  seed/                non-sensitive fixture records
  tests/               database and integration verifications
```

Codex can adjust directory names if needed but retain clear domain/UI/database separation.

## Frontend

React + TypeScript (strict mode), Vite, react-router or equivalent, Tailwind and CSS custom properties for theme semantics. A shared typed component system with theme tokens and limited theme-specific variants for the Inked Fantasy Status composition / rune dividers. Shared six-tab navigation. On iPad, Status side-by-side, Quests left list + right editor, Calendar left month + right day detail; no separate data model.

Do not duplicate feature components between themes. Themes change colors/fonts/surface composition, not quest or ledger logic.

## Authentication and access

Supabase Auth with one privately provisioned email/password account; no public signups. RLS ownership on all user tables and authorized routines. Use Supabase client publishable/anon key in browser only; never expose `service_role`, database credentials or unscoped administrative functions. HTTPS in deployment, environment variables for public project URL/anon key. Supabase dashboard provision/secret setup remains a manual user action.

## Transactions

**Critical:** Reward awarding, editing and correction are transaction boundaries. PostgreSQL unique constraints + RPC functions or equivalent server-authoritative mechanism must make a single occurrence idempotent across devices and concurrent clicks. Do not make a client `insert` plus separate client `increment stats` calls. No trusting client-derived totals without recomputation/validation. Consider owner-checked `SECURITY DEFINER` functions with restricted execute rights, explicit `auth.uid()` validation, carefully configured `search_path`, and row locks; or safe invoker functions and RLS. Service-role operations stay server-side only.

## Persistence and projections

Store canonical activity/outcome/correction events and configuration snapshots; derive or transactionally refresh current stat totals, corrected lifetime XP, monotonic level and daily summaries. Use audit events or transactional compensations; don't merely delete incorrect historical rewards. Create version numbers on mutable occurrences to reject stale updates. Ensure sleep/quest/hobby finish idempotency keys.

## Time model

Save UTC timestamps in PostgreSQL `timestamptz`, account timezone as IANA string (`Asia/Kolkata` initial), and separate local DATE columns for `quest_day`, `scheduled_date`, `actual_activity_date`, `sleep_night_date`. 03:00 turnover applies to **quests**, not Sleep's night. DST-safe conversions via named time zones, not a fixed offset or UTC date slicing. Date selection displays account-local dates and correct weekdays. Reconciliation when user next opens after offline days; deterministic database checks on modifications; never rely on background browser timer.

## Sync and offline

Online-first PWA. Cache shell/assets if useful for installation and revisit, but server writes only when online. Explicit loading, save failure, conflict and offline states. Refetch on focus/online transition; use Supabase real-time or polling if it demonstrably improves 2-device use, without trusting event order for accounting. Confirm server commits before showing permanent saved status. Persist theme locally immediately, sync to user profile when authenticated.

## Security and privacy

Habit records may include private lifestyle behavior. Default no third-party analytics, no public dashboards or share links. RLS with automated tests proving no cross-user access. Avoid logging sensitive quest content in production console. Export JSON only after authentication; never expose as unsigned public bucket object. Implement reasonable rate limits / auth controls using Supabase facilities.

## Quality gates

- Unit tests: progression threshold, stat floor, XP correction, streaks, recurrence and midnight vs 03:00, annual leap dates.
- Database integration tests: RLS, unique occurrence award, atomic updates, conflict rejection, reconciliation across two clients.
- Playwright: phone and iPad screen sizes, two themes, nav, editors, daily report, date correction, sleep shared record, archive / restore flows.
- Accessibility: semantic labels, keyboard focus, 44×44 CSS px tap targets where feasible, 16px minimum input text to avoid mobile autozoom, adequate contrast, reduced motion.

## Hosting deferred

Do not spend the first milestone on DNS, Hostinger panels, SSL configuration or live data migration. Use local Vite dev server, Supabase development project or local Supabase setup if practical. `DEPLOYMENT.md` can be produced after functional milestones. Hostinger Business is already the chosen frontend host.
