# Instructions for all coding agents — Progression System

## First action (mandatory)

Read `README.md`, all files in `docs/`, both `design/*/design-spec.md`, and inspect the corresponding HTML/CSS reference files and PNG design boards **before implementing UI**. Begin by writing a short architecture and milestone plan in your response. Do not assume screenshot sample numbers are logically correct.

## Source-of-truth precedence

1. Direct user request in current Codex conversation.
2. `docs/DECISIONS.md` and `docs/PROGRESSION_RULES.md`.
3. `docs/PRD.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, `docs/USER_FLOWS.md`, `docs/ACCEPTANCE_TESTS.md`.
4. `docs/DESIGN_SYSTEM.md`, theme design specs, original HTML/CSS and PNG assets.

Conflicts: user-approved mechanics always beat mockups. Original source designs must stay unmodified. The files include legacy visual examples, with known errors (Level 7→8 `927` incorrect; should be `929`; Nov 4 2026 is Wednesday; other XP mismatch). Standardized test fixture: `tests/CONSISTENT_SAMPLE_DAY.md`.

## Non-negotiable product invariants

- Default theme = **Inked Fantasy**; other theme = **OLED Black**; one codebase, shared behavior, persistent setting.
- Stats STR/INT/VIT/DIS/BNK each begin at 0 and never display below 0. Energy is a separate daily text state, not a resource meter.
- Positive awarded points ×150 XP. Negative outcomes do not directly remove XP. Correct incorrect awards and their XP; never lower unlocked Player Level.
- Streak every third consecutive scheduled completion affects all configured nonzero stats with +1 or −1 in each configured sign. Volatile same-outcome streaks; missed/unreported breaks at 03:00, no retroactive streak restoration.
- One award per scheduled occurrence, unique and atomic across two devices. Historical revisions are audited; no duplicate XP.
- Sleep fixed categories and rules independent from 03:00 cutoff, with sleep-night date for effects and following day for Energy; one shared record from Quests, Sleep Log and Calendar.
- Never turn missing Volatile into a negative recorded choice.
- Routine: only parent reward upon all children done. Hobby: independent rewardable scheduled subtasks, distinct Archive / Finish / Delete, finish bonus exactly once. To-Dos: no stats/XP/dates; one-level nesting and inline archive.
- Six tabs (Status, Quests, To-Dos, Calendar, Hobbies, Hub), report fullscreen without tabs.
- Private single-user v1 with server-enforced auth and Row Level Security.

## Engineering expectations

- React, strict TypeScript, Vite, Tailwind+semantic CSS variables; Supabase Auth/Postgres/RLS; installable online-first PWA; Vitest+Playwright.
- Pure domain utilities separate from components; backend transaction/idempotent award logic; `auth.uid()` permission checks. No client-authored XP total write. No service-role keys in frontend; no hardcoded credentials.
- Correct local quest-day and sleep-night handling; support DST-safe timezone model (account zone `Asia/Kolkata` initial) and real calendar years.
- Run existing unit/test suites each milestone; add regression test whenever fixing accounting/scheduling bugs. Output commands and test results. Don't claim tests passed unless run.
- No real Hostinger configuration until separately requested; do not invent domain or credentials.
- PWA online-first: no pretending offline changes persisted. Fail visibly and retry safely.
- No framework/theme component duplication. The OLED and Inked design assets are for **styling**; don't replicate fake device chrome in the running app.

## UI quality

- Close to attached design agent's layouts, not generic dashboards. Minimal cards; divider-based editors and archives. Maintain good contrast and touch targets even when screenshot glyphs are tiny. No additional hobby icons, no global progress tracker or fictitious player rank.
- Phone and iPad responsive; iPad master/detail for Quests & Calendar. Long-press options must also be discoverable via three-dot menu.
- Keep meaningful interactive states: unreported, recorded negative, completion, loading, correcting, archived, finished, conflict, offline.

## Working process

Build sequential milestones from `prompts/CODEX_START.md`. Always summarize files changed, commands run, tests, issues and next milestone. Avoid huge untested code dumps and introducing new mechanics. When domain semantics are ambiguous, use `DECISIONS.md` defaults; if still unresolved, document the smallest question and proceed with non-destructive scaffolding.
