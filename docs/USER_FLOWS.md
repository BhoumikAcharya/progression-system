# Navigation, interactions and states

## Information architecture

Permanent navigation on ordinary phone/iPad views: **Status / Quests / To-Dos / Calendar / Hobbies / Hub**. Hub contains Sleep Log, Quest Archive, Hobby Archive, To-Do Archive (deep-links into To-Dos), Settings. Main add/edit editor opened from Quests `+` for all quest types. Morning System Report is the only designed fullscreen takeover without tabs.

## Day 1 onboarding (single-user)

Private sign-in; create profile with player name, IANA timezone `Asia/Kolkata`, Inked Fantasy default; do not force the user through a lengthy survey or pre-generate all habits. Empty stats all zero, Level 1, XP zero. No sleep record => Energy `-`. Quests empty except Sleep Check-In. Simple add quest affordance. User creates their first quest, schedule and effects.

## Typical morning

At first open after 03:00, reconcile missed occurrences (regardless of browser being closed). If report for preceding quest day has not been shown on this account, open full-screen report once. User presses Continue to Player Status, sees current stats and Energy from previous sleep night. Visits Quests, selects previous sleep night category in Sleep Check-In (if not recorded), immediately sees Energy and appropriate sleep-night history updated. Reviews today's due quests and routines, adds Quick To-Dos.

If there is no prior activity, display zeros / `-` honestly and avoid fabricated streak or rewards.

## Completing Standard

Tap checkbox. Submit event to server. On success, show greyed completed card with result line (effective STR/VIT etc, XP, current streak and any third-completion bonus); prevent rapid duplicate reward. If request fails, revert/check failure or show retriable state. Editing completion is available through authorized historical correction, not by secretly creating another occurrence.

## Recording Volatile

Card initial state: neither checkbox selected. Tap outcome A or B. Save chosen label as outcome; result line with effect even if negative, card subdued. Other choice cannot be selected without explicit correction. Unreported at cutoff means missed and no penalty. A user who selects negative outcome is **recorded**, not unreported.

## Routine

Parent shows subtask checklist and no reward until all children checked. Final child automatically completes parent and awards once. Routine subtasks fresh per scheduled occurrence. Older completed occurrence persists with snapshot despite later editing of routine step list.

## Adding / editing quests

From Quests `+`: Add Quest with type selector top-right; Standard, Volatile, Routine, Hobby. Choose type, set name/optional description, recurrence calendar/weekday selector, full five-stat effects via vertical steppers, live XP preview. For Volatile, edit two custom outcome labels independently. For Routine, manage one-level subtask list with parent reward. For Hobby, subtask schedule/reward and one-time finish reward. Save; return to originating tab (Hobby created from Quests but appears in Hobbies). Back/discard warns on dirty form; changing type warns on data loss. Edit locks type, preserves history and active streak for non-schedule edits. Changing schedule resets streak.

## Hobbies

Active hobby card contains due and overdue subtasks with checkbox, outcome reward hints and next scheduled task. Empty card shows `All wrapped up for now. Schedule more tasks.`. Long-press or accessible overflow gives Add Tasks, Edit, Archive, Delete. Finish Hobby action in editor grants bonus once then moves to finished archive. Restored archived hobby resumes with previous history; finished cannot restore. Overdue subtasks can be rescheduled, but this must not create a new reward for an already rewarded occurrence.

## Quick To-Dos

Inline add. Single checkbox completes standalone item. Parent checkbox completes all children; checking final child auto-completes parent. One level of nesting only. Completed item appears inside collapsible To-Do Archive. Restore parent clears all child checks; Clear Archive confirms. Hub deep link opens same To-Dos archive expanded. No dates/XP/stats/streaks.

## Calendar

Primary Monthly view with weekday-aligned dates and `Stats`/`Sleep` selector; additional Weekly and Daily modes. Stats date cell displays net effective stat deltas; distinguish positive, negative, recorded-zero and no records `-`. Sleep mode displays sleep-night records and missing nights; never imply an automatic sleep observation. Selecting date opens **inline summary** on phone; view details expands to detailed Stats/Sleep screen. On iPad month stays left, day details persistent right. Date details shows per-stat totals, XP and recorded quest outcomes. `Correct Entries` expands a small editing panel; correction updates history & report but cannot restore streak. `System Report` manually reopens that date's report.

## Sleep-specific flow

From Quests or Hub Sleep Log, pick *sleep night* explicitly. Choose one of three mutually exclusive bedtime categories, review preview and save. Night stat points apply to night date, next-day Energy appears on Status. Multiple device log or editing from Calendar must update same sleep row, not create extra XP. When an existing sleep record is loaded in Check-In, show completed/subdued state and a clear Edit action. Current quest-day cutoff does not block logging last night in morning.

## Morning System Report

Per account first open after daily cutoff, show preceding quest-day report in full screen with no nav. Contents accurately derived, including missing Energy as `-`. Continue dismisses and marks seen once for this quest day. Calendar link reopens manually. Corrected activities update report in subsequent manual view without auto-popup again. A report seen on phone should not automatically pop on iPad the same quest day.

## Archives

Quest Archive: restorable archived recurring vs view-only completed one-time; restore resets streak. Hobby Archive: paused vs finished, simple rows, no icons-per-row, restore only paused. To-Do Archive: inline section, Restore and Confirm Clear. Deleting quest/hobby must retain reward history and calendar evidence.

Quest and Hobby Archive also show completed occurrences from all dates, including history from definitions later archived or deleted. To-Do Archive has no date filter and displays completed checklist children beneath their parent.

## Settings

Player name editor; Appearance theme selection (default Inked Fantasy, alternative OLED Black) applies instantly and persists; System Rules read-only; data export; real sync status and failure messaging. No UI to casually edit XP formula, stat definitions, level multiplier, sleep categories or 03:00 rule.

## Visual and interaction states Codex must implement

Empty, loading, saved, saving, success, network error, stale edit / sync conflict, offline, completed, recorded negative, unreported, late correction, overdue, archived, finished, read-only, confirmation dialog, unsaved form, and accessible focus.

## UI priorities

One-tap recording should remain effortless. Use touch-target enlargement without cluttering visual size; tab bar safe-area spacing; scroll content without hiding save button; success feedback inside quest cards. System-level level-up feedback can be restrained. No giant edit cards for each field, no arbitrary hobby icons.
