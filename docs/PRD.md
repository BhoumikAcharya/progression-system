# Product requirements document — Progression System v1

## Product vision

A private mobile/iPad web app that makes personal habits and longer-term goals visibly accumulate into a coherent Player Status. Inspired by Solo Leveling's system interface, but focused on daily usability rather than game mechanics for their own sake. Positive habits are rewarded, negative habits are **explicitly logged** and visible, missing logs remain unreported, and progression history is trustworthy. Primary goals: encourage consistency, encourage honest reporting, and reveal week/month patterns.

## Target user and platform

Single owner using one account on phone and iPad. Installable responsive PWA, online-first, sync across devices. **Default theme Inked Fantasy** with instant user-selectable OLED Black. Private access. User controls quest names, schedule and stat effects. Users already track actual finances and media screen time elsewhere; no need to import those values.

## Key user story

After 03:00 quest reset, first app open automatically shows the **previous quest day's report**. User dismisses to Status, checks Energy, logs the previous sleep night from Quests if needed, checks or creates quests and Quick To-Dos, records routine tasks during the day, and optionally records current bedtime in the evening. User later reviews Calendar, correcting historical records without manufacturing streaks or XP. Hobbies support individually scheduled milestones with an optional final completion award.

## Feature scope by section

### Main navigation

Six bottom destinations, in order: `Status`, `Quests`, `To-Dos`, `Calendar`, `Hobbies`, `Hub`. Persist on ordinary supporting screens; omit during automatic full-screen Morning Report. Accessible back navigation. iPad may use two-column content panels but the same six destinations.

### Status

- Player name editable from Status and Settings, no avatar, rank, HP, MP, fatigue or global streak.
- Level and accurate XP progress to next unlock (never fall in level; show corrections honestly).
- Five stat values with monochrome outline icons in one row on phone, more spacious on iPad: Strength, Intelligence, Vitality, Discipline, Bank.
- Energy from previous sleep night: Excellent / Medium / Low / `-`, text, no numeric meter. On OLED, upper-right; in Inked, visible as a labeled line near hero level, with iPad upper-right.
- Today at a Glance: XP, gross gained, gross lost, quest completion count, current top per-quest streaks; no activity feed or 30-day sparkline in v1.

### Quests

- Default active scheduled occurrences for current 03:00 quest day; Show Sleep Check-In at top with explicit sleep night and three choices.
- Standard quest: single checkbox. Volatile: exactly two custom-labeled mutually exclusive checkbox outcomes, initially neither selected; Routine: parent with subtask checkboxes, only completed when all children done.
- Mark completed card subdued/greyed but **retain readable result message**, showing exact effective stats, XP, streak bonus, selected outcome, and any floor limitation. No modal for routine completion.
- Quest actions through long-press **and** visible accessible overflow menu: Edit, Archive, Delete. Create from floating `+` opens shared editor. No Hobby entries on Quests list; Hobby type created here only.
- Completed occurrences remain visible for current day; no double rewards.

### Shared Add/Edit Quest

- Header Add Quest / Edit Quest with right-aligned type selector. Creation offers Standard, Volatile, Routine, Hobby/Project. Type locked on edit. Prompt before discarding unsaved form when changing creation type.
- Name + optional description; schedule picker Every Day / Specific Days / Monthly / Yearly / Once; contextual date/day picker. For monthly, render monthly calendar selection; for weekdays, show Mon–Sun calendar/chips; yearly choose month/day; once pick concrete date. No every-N-weeks or flexible X/week.
- Full five-stat **vertical stack editor** with icon/name/minus/signed value/plus. Values can be negative, zero, positive. Live XP preview counts positive assigned points × 150.
- Volatile: edit both outcome labels and independent five-stat effects with compact outcome tabs, no ten simultaneous stat rows required.
- Routine: one-level subtask list, reorder, add, rename, remove; stat effects only on parent.
- Hobby: independent scheduled/rewarded subtasks, add/edit/reorder/delete; configurable one-time Finish reward default INT +5, plus Finish action when editing active hobby. Hobby create from Quests only.
- Save pinned above bottom nav; inline validation, cancel, unsaved-change warnings and destructive confirmation.

### Quick To-Dos

- Plain lightweight inline add field; independent checkboxes, rename/delete/reorder, no dates, points, XP, streak or quest completion count.
- One level nested checklists. Checking parent checks all children; checking all children completes parent. Completed items move into **inline collapsible To-Do Archive**.
- Restoring parent clears all children, returns to active; Clear Archive with confirmation. Hub shortcut opens To-Dos with Archive expanded; not a separate tracking system.

### Hobbies

- Active Hobby/Project parent cards with name, current/overdue subtasks, stat hints, next scheduled task and finish reward. No progress %, no general hobby streak, no unnecessary icons per hobby.
- Each hobby subtask has own occurrence schedule and configurable effects, earns once per occurrence; overdue tasks remain visible and reschedulable. When none remain, show: `All wrapped up for now. Schedule more tasks.`
- Overflow/long-press: Add Tasks, Edit, Archive, Delete. Finish action in editing experience: awards one-time finish points then permanently archives. Archive/restore is reversible and does **not** award finish bonus. Delete preserves historical ledger and calendar records.

### Sleep

- Fixed bedtime categories, see `PROGRESSION_RULES.md`. Dedicated Hub > Sleep Log: date selector, three options, preview of Energy/stat effects/XP, Save, sleep-night history, historical editing.
- Same record accessible by Quests' Sleep Check-In, which becomes completed/subdued once logged; both interfaces share one database row. Sleep effects applied to sleep-night date, Energy to next calendar date. Independent of quest reset, no streak, no quest count.

### Calendar

- Stats/Sleep toggle and Monthly / Weekly / Daily views. Month grid correct by actual weekdays; date shows gained/lost/zero/unreported distinction with net points only for Stats mode, sleep-night entry category for Sleep mode. Missing `-` is not failed.
- Selecting a day shows an **inline summary on phone** with earned XP, gross effective gains/losses/net, five-attribute deltas, key activities and View Details. **iPad** shows month left, persistent detail pane right.
- Day Details has prev/next date, Stats/Sleep switch, recorded positive and negative Volatile outcomes and their exact effects, hidden-until-requested correction controls, sleep-night correction, System Report link.
- Corrections update ledger/history; cannot revive broken streaks or duplicate XP.

### Archives

- Hub > Quest Archive separates archived restorable recurring quests from view-only completed one-time quests. Archive resets streak; restore starts new streak. Deletion preserves histories.
- Quest Archive also lists valid completed quest occurrences across all dates, with their activity dates.
- Hub > Hobby Archive separates Paused (restorable) from Finished (permanent) using simple divider rows, **no per-hobby icons and no cards per row**.
- Hobby Archive also lists valid completed subtasks across all dates, with their activity dates.
- Hub > To-Do Archive opens embedded collapsible archive in To-Dos, with Restore and confirmation-protected Clear.
- The inline To-Do Archive shows completed roots and their checklist children across the full To-Do history.

### Morning System Report

- Automatically first open after 03:00 per account quest-day; previous day; once per day, full-screen, no bottom nav.
- Results-only layout: report date, hero XP earned, gross points gained/lost/net, recorded quest count, Energy for report date or `-`, five stat effects, meaningful per-quest streak milestone, Continue to Status.
- Calendar can open any historical report. Corrections recompute stored report view without retriggering auto-popup. No sunrise, Today's Plan or decorative animation.

### Hub and Settings

- Hub grouped divider rows: Tools (Sleep Log), Archives (Quest/Hobby/To-Do), Settings. Minimal, no tile grid.
- Settings: player name, **Theme picker** (Inked Fantasy default / OLED Black), read-only progression guide, secure export/backup, synchronization status only when real synchronization exists. Avoid unrelated features or fabricated sync timestamps.

## Core invariants

All exact math, idempotency, 03:00 rollover, historical edit semantics, stat floor, recurring eligibility, per-outcome streak behavior and correction rules are in `docs/PROGRESSION_RULES.md` (normative). Every completion is unique per schedule occurrence. No negative XP from a negative habit. No decreasing unlocked Player Level. Never conflate missed Volatile with the negative outcome.

## Nonfunctional requirements

- Responsive phone and iPad; six-tab bottom nav remains touch-friendly and safe-area aware; content scrolls under fixed nav safely.
- Accessible controls: keyboard / screen-reader labels, usable contrast, sufficient tap hit areas, large enough form text, visible focus rings, reduced-motion support.
- Private records, RLS and authenticated session; no user content or secret keys embedded in source.
- Correct state after refresh, page navigation, reload, brief network interruption, or switching devices. Save feedback and conflict handling.
- Reliable calendar with correct leap years, time zone, 03:00 cutoff and sleep-night crossover.
- Tests: logic unit tests, server transaction uniqueness/ownership tests, end-to-end flows on both themes/viewports.

## Out of scope

No automatic expenditure tracking, actual savings/bank ledger, raw YouTube summary import, Apple Health, streak pressure notifications, flexible X/week schedules, every-N-weeks, habit inference, HP/MP, ranks, full-screen game art, social or collaborative features.
