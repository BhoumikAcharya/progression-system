# Acceptance criteria and required automated tests

Each numbered invariant must be a repeatable test with meaningful assertions. Use pure-function unit tests for math/scheduling, database integration tests for uniqueness/atomicity/RLS, Playwright for UI user flows. Tests should run locally with documented commands. Do not claim a feature done because a static mockup looks correct.

## A. Progression math

1. New profile: five stats=0, Level=1, XP=0, Energy=`-`, theme=`inked-fantasy`.
2. Positive config STR+2, VIT+1 credits 450 XP; negative config VIT−1, DIS−1 credits 0 XP. Mixed effects STR+2 and VIT−1 credit 300 XP.
3. Transition requirements: 400, 460, 529, 609, 701, 807, 929. Verify no premature Level 8 at 927; ensure cumulative thresholds are used for lifetime progression.
4. Correct an incorrectly awarded +2 STR: reverse its +2 and 300 XP with an audit record; Level achieved does not decrease.
5. XP corrected below already unlocked Level's cumulative floor: level remains achieved, progress bar clamps to 0, remaining XP for next level displays accurately; future level only unlocks on correct cumulative XP.
6. Stat at 0 receiving −2: displayed 0; raw negative recorded, effective applied delta=0, XP=0. Stat=1 receiving −2: effective −1, displayed=0. Daily loss counts effective penalty rather than the attempted −2.
7. Backdated correction changes downstream floor-dependent effective stats and affected daily reports deterministically, without duplicating XP.
8. `tests/CONSISTENT_SAMPLE_DAY.md`: gain +6, loss −1, net +5, XP +900, signed STR +2 INT +1 VIT +1 DIS +2 BNK −1.

## B. Streaks and quest occurrences

9. A daily quest with STR+2: runs 1,2 award +2; third awards +3 and 450 XP; sixth gets bonus again; fourth/fifth normal.
10. Mixed +2 STR/−1 DIS: third matching completed occurrence awards +3 STR/−2 DIS and 450 XP.
11. A Mon/Wed/Fri scheduled quest completes Mon, Wed, Fri and qualifies for third bonus. Non-scheduled intervening days do not reset streak.
12. Volatile outcome `Yes` three consecutive scheduled occurrences yields bonus in configured sign direction. Changing to `No` starts the matching-outcome streak at 1; **negative recorded** differs from unreported.
13. At 03:00 unreported due quest closes, never grants penalty, and breaks current streak. Historical Calendar entry cannot restore the break.
14. Change recurring schedule resets current streak but preserves prior earned stats/XP; edit name or points does not retroactively rewrite past snapshots.
15. Archive resets streak; while archived, do not generate due occurrences; Restore starts fresh without duplicating old awards.
16. Completed one-time task stays visible as completed until next quest reset, then moves to view-only Quest Archive; cannot award again.
17. Retry/double-tap same occurrence returns same one recorded outcome, one reward; unique database key protects against duplicate records.
18. Two concurrent device submissions to same occurrence cannot double award; second stale correction is rejected with actionable conflict state.
19. Remove incorrect historical completion: its reward/XP and illegitimate dependent streak bonuses are compensated. Do not retroactively award *new* streak bonuses for backfill.

## C. Dates and recurrence

20. In `Asia/Kolkata`, Nov 5 02:59 quest-day key=Nov 4; 03:00 key=Nov 5. Dec 31→Jan 1 transitions and 1 AM bedtime handled.
21. App stays closed for 10 days; re-open reconciles all due occurrences, closes unreported and breaks streaks deterministically, never double processes on next open.
22. Specific weekdays respects actual weekday alignment. Example Nov 4, 2026=Wednesday. Monthly day 31 falls last valid date of shorter month; Feb29 yearly falls Feb28 in nonleap year.
23. Late monthly completed quest keeps scheduled date and actual completion date separately; rewards/calendar attribution on actual activity date, streak eligibility by due occurrence.
24. ONCE date shows one due occurrence and never repeats even across multiple logins.
25. No `every N weeks` or X/week quota controls exist anywhere.

## D. Sleep

26. Sleep night Nov 4, logged Nov 5 morning: VIT+1, DIS+1, 300 XP apply to Nov 4 if EARLY; Nov 5 Energy Excellent.
27. `MIDDLE` produces no stats/XP and Energy Medium; `LATE` produces DIS−1 (respecting floor) and Low; absent sleep record shows `-`.
28. Nov 5 01:30 bedtime can belong to Nov 4 sleep night; independent of 03:00 quest reset.
29. Save via Quests and view via Hub/Calendar; all reference same record. Correct from a second screen updates existing row and reverses/replaces its effects rather than awarding twice.
30. Sleep never counts in quest completion or streak bonus.

## E. Tasks, hobbies, To-Dos and archives

31. Partial routine subtasks yield 0 XP and no parent completion; final child awards parent once; next occurrence resets checklist.
32. Hobby tasks have no dates: ticking a task awards once; ticking a repeatable task on two different quest days awards twice, twice on the same day awards once; today's tick can be undone. No parent completion %.
33. Archive hobby (no finish reward), restore history; Finish Hobby awards configurable +5 INT => +750 XP one time and is permanent; delete preserves historical earned records.
34. To-Do parent checkbox selects children, final child auto-completes parent, archive is embedded, restore clears all children, Clear Archive prompts for confirmation; never awards XP.
35. Quest/Hobby deletion does not erase historical Calendar, stat ledger or XP ledger rows.
36. Quests of different types only show on due dates; a missed one-time quest offers Record late; no automatically created mandatory daily quest penalties.

## F. UI and UX

37. Six tabs in fixed order at phone and iPad sizes; bottom nav hidden only during full-screen Morning Report.
38. Both themes render same data and behavior; Inked Fantasy default on fresh profile; switch instantly under Settings and persist after reload, without modifying rewards/history.
39. Add/Edit Quest vertical five-stat editor uses signed values and functional +/- controls; Volatile edits two independent outcome effects; Routine/Hobby editors meet their distinct rules.
40. Long-press and overflow actions exist; all controls keyboard-accessible, properly labeled and touch-friendly. Completed quest System message remains legible.
41. Calendar renders missing/no-record `-`, recorded zero `0`, positive/negative totals as distinct states; Stats/Sleep selector and Monthly/Weekly/Daily modes work.
42. Morning Report shown once after 03:00 reset across account/devices, no nav; manual Calendar reopening works and historical correction updates report without new auto-popup.
43. iPad: Status two columns, Quests list/edit split pane, Calendar grid/detail split pane. Phone: corresponding single-column pages and inline day summary.
44. Online-first: missing connectivity cannot silently save; user sees clear failure/offline state; retry must not double reward.
45. Real profile data never leaks across users; RLS denial tests and authentication gates pass.
46. Settings has truthful sync state, functional JSON export with schema version, and no fake success message or credentials embedded.

## Smoke-test paths for each milestone

- Milestone 1: login/route nav/theme persist; responsive snapshots; private route auth.
- Milestone 2: pure stat, XP, streak, recurrence + database idempotency tests.
- Milestone 3: create Standard/Volatile/Routine and confirm correct card states and rewards.
- Milestone 4: Hobby, Sleep, To-Dos; shared records, archives and data integrity.
- Milestone 5: Calendar, historical corrections and Morning Report; two-device collision simulation.
- Milestone 6: complete mobile/iPad + two themes Playwright suite, accessibility and backups/export.
