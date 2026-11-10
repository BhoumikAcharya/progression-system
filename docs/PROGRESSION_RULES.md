# Progression engine — normative rules

Every screen consumes a **single authoritative domain engine**. Never embed reward calculations, calendar rollover logic or streak arithmetic directly in React components. Implement as pure tested functions + transactional Supabase write functions. Keep an audit trail.

## 1. Terms

- `quest_day(date_time, zone)`: local date after shifting the local time by −3 hours. Thus 2026-11-05 02:59 IST belongs to the Nov 4 quest day, 03:00 belongs to Nov 5.
- `scheduled_occurrence`: a distinct recurrence due slot for a specific quest; has stable identity even if entered later. Hobby tasks have no due slots; a hobby completion is keyed by task and the quest day it was ticked.
- `actual_activity_date`: user's declared date of performing task. A past correction uses the date of the activity, not merely the timestamp when the app was opened. For quest-day tasks, use the local quest-day date; Sleep is special.
- `recorded_at`: immutable creation timestamp; `updated_at` for corrections; these are not activity dates.
- `raw_effect`: signed stat delta configured at the occurrence and saved in immutable config snapshot, e.g. `{STR:2, VIT:-1}`.
- `streak_effect`: third-consecutive bonus delta; directional +1 or −1 on nonzero affected stats.
- `effective_effect`: change after applying stat floor in deterministic time order.
- `xp_credit`: 150 × number of positive points actually awarded by the configured + streak effects. Never subtract XP just because a negative habit was recorded.

## 2. Stats

Stat keys exactly `STR`, `INT`, `VIT`, `DIS`, `BNK`. Initialize all to 0. Display `max(0, running_stat)`. Prefer replaying the ordered event stream so the stored running state also never goes negative. Corrections can change downstream floor-limited effective changes and daily summaries. Preserve raw and effective effects separately. Effective point gains and losses in Calendar/Report are from applied nonzero deltas, and negative habits logged at 0 remain visible as recorded outcomes.

Examples:

- STR=0, event STR −2 => raw −2, effective 0, displayed STR=0, XP=0.
- STR=1, event STR −2 => effective −1, displayed STR=0, XP=0.
- STR=0, event STR +2 and VIT −1 => STR +2 effective, VIT 0 effective if VIT=0, XP=300.
- A later correction to a historical event requires deterministic replay of subsequent stat changes in time order.

## 3. XP and levels

XP per positive stat point: 150. Sources include positive quest rewards, positive streak bonuses, positive hobby subtask/finish rewards, and the fixed positive sleep reward. Negative stat effects, zero-effect outcomes and unreported tasks earn no XP.

Transition cost `T(1)=400`; `T(n+1)=ceil(T(n)*1.15)`; `T(n)` means cost to go from Level n to Level n+1.

Transition costs:

| 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 400 | 460 | 529 | 609 | 701 | 807 | 929 | 1069 |

Absolute XP required to have reached Level `L`: `C(1)=0`, `C(L)=sum_{n=1}^{L-1}T(n)`.

`corrected_lifetime_xp`: sum of currently valid positive reward credits, corrected for invalid completion entries; never negative. This is different from *negative-habit penalties*, which never subtract XP.

`highest_level_achieved`: persistent monotonic unlock; when corrected lifetime XP crosses `C(next_level)`, unlock next levels as needed; never reduce this value on corrections. If a correction leaves current XP below C(highest_level_achieved), XP progress bar toward the *next unachieved level* is clamped to zero; remaining XP displays `max(C(highest_level_achieved+1) − corrected_lifetime_xp, 0)`. This explicitly preserves levels without granting an unearned new one.

For an ordinary in-range state, `level_bar_fraction = clamp((corrected_lifetime_xp - C(level))/T(level),0,1)`. Show both progress and genuine remaining XP; don't use erroneous mockup value 927 for Level 7→8.

## 4. Recurring occurrences and the 03:00 cutoff

Supported: `DAILY`, `WEEKDAYS` (nonempty set Monday–Sunday), `MONTHLY` (day-of-month with last-valid-date fallback), `YEARLY` (month/day; Feb29 → Feb28 on nonleap years), `ONCE` (one date). No weekly frequency quotas, biweekly, or every-N-weeks.

Scheduled quest occurrences are derived from recurrence spec + lifecycle active periods, with deterministic stable IDs. When an account next opens, reconcile all prior closed quest days, not only "yesterday"; 03:00 cutoff must function even after 10 days offline and must be safe to re-run. Unreported occurrences remain missing; they do NOT automatically become a negative Volatile selection.

A completed recurring occurrence remains greyed in the Quests page for the remainder of its quest day. A completed one-time quest automatically archives after the next 03:00 rollover. Missed occurrence stays available for historical correction through Calendar; never automatically grants streak credit when backfilled.

## 5. Streaks

- Consecutiveness refers to consecutive **scheduled eligible occurrences**, not necessarily consecutive calendar days. A Mon/Wed/Fri quest can streak Mon→Wed→Fri.
- For Standard or Routine: consecutive completed scheduled occurrences; an unreported slot closes/breaks streak. For Volatile: consecutive *same selected outcome*; changing outcome starts the new matching-outcome streak at 1.
- Third, sixth, ninth, ... consecutive completed matching occurrences earn +1 additional point **for every nonzero configured affected stat**, using each stat's sign. E.g. +2 STR, −1 DIS yields +3 STR, −2 DIS at streak 3.
- Positive bonus points generate XP; negative bonus points don't deduct XP.
- Restoring an archive or changing the schedule sets active streak to zero; first eligible completion starts at 1.
- Historical calendar edits never revive a broken streak, create new bonuses, or recreate streak progress from the past. Invalidated awards are compensated, including dependent illegitimate bonus events (see decisions register).
- No global aggregate player streak exists. Status may show a list of currently active per-quest streaks.
- Sleep and Quick To-Dos never have quest streaks.

## 6. Idempotent rewards and corrections

Use **one record per source occurrence** plus revisioned updates. A duplicate submit/retry on a second device returns the existing stored result, not another reward. Award hobby finish reward under unique `(hobby_id, reward_type='finish')`. Sleep under unique `(user_id, sleep_night_date)`.

For any correction: begin transaction, lock/verify current version, determine previous raw/streak/effective rewards, store correction audit trail, replace current outcome, compensate ledger entries, replay as necessary, recompute XP/level unlocks/streak dependencies, commit. Never simply add rewards again. Historical snapshots remain retrievable. On concurrency collision tell the user to refresh and reconcile.

## 7. Volatile

Both outcomes individually named and independently configured, including mixed-sign or zero effects. Initially `UNREPORTED`. Clicking one selects it; the other becomes unavailable on completed card. Logged negative outcome is **recorded**, not missed. Correcting changes/reverses precisely the relevant outcome's awards. An unreported outcome expires at cutoff and breaks streak but never creates a penalty.

## 8. Routine

All subtasks must be complete to award the parent once. Partial completion never awards parent points. Subtasks have no stat effects of their own. If all child checkboxes checked, complete parent automatically. For the next scheduled occurrence, show fresh unchecked children. Editing the parent does not retroactively change recorded historical reward snapshots.

## 9. Hobbies

Hobby tasks carry no dates and are never overdue. Each task awards its configured points **once**, on the quest day it is ticked. A task marked repeatable may be ticked again on a later quest day and awards each time, at most once per quest day (unique `(step_id, scheduled_date)`). Today's tick can be undone, which withdraws its award. Parent Hobby has no progress % or global hobby streak. Finish Hobby awards configured bonus once (default +5 INT => +750 XP) and becomes permanently archived; Archive alone grants none and is restorable. Delete removes active management but preserves audit/history.

## 10. Sleep and Energy

Saved sleep-night date is distinct from quest-day and logging timestamp. The night of Nov 4 gives stat effects on Nov 4 and sets Energy on **Nov 5**. After-midnight bedtime still attributed to Nov 4 sleep night. 

| category | night stat effects | following-day Energy | XP |
|---|---|---|---:|
| `EARLY` 21:00–23:00 | VIT +1, DIS +1 | Excellent | 300 |
| `MIDDLE` 23:00–01:00 | None | Medium | 0 |
| `LATE` after 01:00 | DIS −1 | Low | 0 |
| no record | None | `-` | 0 |

No sleep streak or quest count. Quests check-in, Hub Sleep Log and Calendar Sleep view write/read same record and cannot double award.

## 11. Historical reports

Calendar day stats and Morning System Report derive from canonical records with effective stat changes for their attributable dates. Reports must distinguish no data `-` from recorded zero and recorded negative. Corrected records recompute historical reports; never force automatic re-show of an already dismissed report. Report first-open display is once per quest day per account, with account-side dismissal marker; full-screen with no bottom navigation.

## 12. Example worked day (consistent)

Assume all stats start high enough to absorb penalties and Nov 4 has:

- Gym +2 STR and +1 VIT ⇒ +3, +450 XP.
- Read +1 INT ⇒ +1, +150 XP.
- Night Routine base DIS +1, with its third-consecutive completion bonus DIS +1 ⇒ DIS +2, +300 XP.
- Volatile outcome "No" BNK −1 ⇒ −1, 0 XP.

Gross gained **+6**, gross lost **−1**, net **+5**, XP **+900**. Signed stat changes: STR +2, INT +1, VIT +1, DIS +2, BNK −1. Date is **Wednesday, Nov 4, 2026**. If stats are at zero, effective negative may differ and summaries must reflect that honestly. This fixture should replace inconsistent mockup numbers.
