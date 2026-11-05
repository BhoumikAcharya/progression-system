# Copy/paste this into the Codex agent (repository opened)

You are the lead engineer for **Progression System**, a private mobile-first PWA for real-life gamified habits and progress. The repository contains comprehensive finalized requirements and two original reference design systems. Treat these files as authoritative and **read them before coding**:

1. `AGENTS.md`
2. `docs/DECISIONS.md`
3. `docs/PRD.md`
4. `docs/PROGRESSION_RULES.md`
5. `docs/ARCHITECTURE.md`
6. `docs/DATA_MODEL.md`
7. `docs/USER_FLOWS.md`
8. `docs/DESIGN_SYSTEM.md`
9. `docs/ACCEPTANCE_TESTS.md`
10. `tests/CONSISTENT_SAMPLE_DAY.md`
11. Both `design/oled-black/design-spec.md` and `design/inked-fantasy/design-spec.md`, plus the attached HTML/CSS + PNG design boards in both directories.

**Themes:** Inked Fantasy default, OLED Black optional, instantly selectable from Settings. One shared data model, one shared progression engine, one component system with semantic theme tokens. Preserve the design agent's typography, layouts, state styles and iPad adaptations as much as practical. Do not replace them with generic UI kits.

**Stack:** React + TypeScript + Vite, Tailwind + CSS variables, Supabase Auth/Postgres with server-enforced RLS and atomic idempotent reward operations, online-first installable PWA, Vitest + Playwright. Future deployment is Hostinger Business, but **do not spend time deploying yet**.

**Critical mechanics:** 3 AM account-local quest reset, levels never decrease even after accurate XP corrections, five zero-floored stats, 150 XP per positive point, every 3rd eligible streak completion gives one extra point per affected stat in its sign, no XP deduction from negative behaviors, one reward per occurrence, unique sleep-night records, history-preserving archive/delete actions. Full details in rules and tests.

**Known mockup errors:** Sample Level 7→8 requirement must be 929, not 927; some example calendars label Nov 4, 2026 incorrectly as Tuesday, and gains/XP mismatch. Never implement those hardcoded numbers. Test fixture in `tests/CONSISTENT_SAMPLE_DAY.md` is authoritative.

## Your assignment

**First, inspect the repository and produce a concise phased implementation plan**, identifying how you will structure the domain engine, database, theme system and UI. Then implement **Milestone 1** in this same task:

1. Scaffold the strict TypeScript React/Vite project and basic quality tooling.
2. Implement six-tab mobile layout and responsive iPad shell with real routes and placeholder/empty states for screens; avoid fake hard-coded user progression.
3. Implement semantic Inked Fantasy + OLED Black tokens with Inked as default and functioning Settings theme switch that persists locally; create an abstraction ready to synchronize with the eventual user profile.
4. Create typed domain entities/interfaces and pure stub interfaces for progression/scheduling with explicit TODOs, **not fabricated rewards**.
5. Implement a minimal player-profile initialization experience with zero stats and no sleep Energy, pending backend connection.
6. Add Vitest baseline tests for `T(n) = ceil(previous*1.15)` transitions and basic theme settings; scaffold Playwright visual/smoke tests for phone and iPad navigation.
7. Set up `.env.example`, safe git ignore and clear local setup README instructions. Do not commit secrets or assume Supabase credentials are present.

Run lint, typecheck, tests and local build if available, and fix failures. Provide a summary of changed files, commands, test results, screenshots if possible, and a plan for Milestone 2 (progression engine + Supabase schema + RLS + transactions). **Stop after Milestone 1 for UX review** rather than attempting the entire feature set in one pass.

For any design mismatch, prioritize user-approved requirements over stale mockup examples and explicitly note where you chose readability/accessibility over tiny pixel sizes.
