# Decision register — v1

**Status:** Finalized product decisions plus **recommended implementation defaults** for the remaining edge cases. The latter are explicit so they can be approved or changed; they must not be presented as user-verified historical choices. Where the user supplies a correction, update this register and dependent tests before coding.

## Locked product decisions

- **Themes:** Inked Fantasy default; OLED Black as a selectable alternate. Theme choice is persistent and visual-only.
- **Six navigation tabs:** Status, Quests, To-Dos, Calendar, Hobbies, Hub. Bottom nav persists except full-screen Morning System Report.
- **Stats:** STR, INT, VIT, DIS, BNK start at 0, display floor 0, no upper limit. Energy separate, not numerical. No HP, MP, rank, or avatar.
- **XP and Levels:** 150 XP per positive awarded stat point. Negative outcomes do not directly deduct XP. First level transition requires 400 XP; each next transition is `ceil(previous * 1.15)`. Once reached, levels never decline. Incorrect awards are corrected, including their XP.
- **Streaks:** Every third consecutive scheduled completion (3, 6, 9...) gives an additional +1 to each positive configured affected stat or an extra −1 to each negative configured affected stat. For Volatile, streaks follow consecutive matches of the same recorded outcome; switching outcomes resets that outcome run. Unreported scheduled occurrences break streaks after 03:00 rollover. Calendar backfill never restores a broken streak. Archiving or schedule change resets active streak. Restore starts fresh.
- **Quest types:** Standard (one outcome checkbox), Volatile (two customizable, mutually exclusive Yes/No-style outcome checkboxes), Routine (subtasks; only parent earns), Hobby/Project (individually rewarded scheduled subtasks; finish reward configurable, default INT +5).
- **Recurrence:** Every Day, Specific Weekdays, Monthly, Yearly, Once. Absolutely no "every N weeks" or flexible X-times-per-week mode.
- **Once-only rewards:** Once per scheduled occurrence, even after syncing, editing, or re-checking; finished hobby award once.
- **Sleep:** fixed three categories: 9–11 PM => VIT +1, DIS +1, Energy Excellent; 11 PM–1 AM => no stat change, Energy Medium; after 1 AM => DIS −1, Energy Low. Not recorded => no effect, Energy `-`. Sleep stat effects belong to sleep-night date; Energy belongs to following calendar date. One sleep entry per night, shared across Quests, Sleep Log, and Calendar, no sleep streak or quest completion count.
- **Quest day:** account-local reset at 03:00; no need for app to be open at reset. Unreported is NOT negative. Partial routine is not complete.
- **Life cycle:** Archiving a quest stops future scheduling, resets streak, preserves records; restoring starts fresh. Completed one-time quest autoarchives at next reset and does not regain rewards. Hobby Archive / Finish / Delete are distinct: Archive restores, Finish is permanent and awards once, Delete preserves history. To-Do Archive is a collapsible section inside To-Dos; restoring a nested checklist clears its children's checks; Clear Archive needs confirmation.
- **Calendar:** Monthly/Weekly/Daily and Stats/Sleep toggles; distinguish gain, loss, exactly zero with recordings, and unreported (`-`). Historical corrections may modify rewards but cannot reconstruct an expired streak. Morning Report opens automatically once after reset on first open of that quest day, can be reopened from Calendar, never reopens on correction.
- **Privacy:** private single-user v1; no open registration, no public profiles, no sharing.

## Engineering implementation defaults — confirm by reviewing this document

1. **XP accounting with irreversible levels.** Keep `corrected_lifetime_xp` (can decrease on corrections, floor zero) and `highest_unlocked_level` (only increases). Maintain cumulative absolute XP thresholds. Level-up to N+1 only when corrected XP reaches the *cumulative* XP threshold for N+1, even if the displayed level was already grandfathered after a correction. If XP is below the cumulative floor of the current unlocked level, show progress bar at 0 and show accurate absolute XP still needed for next level; don't misstate progress as debt-free.
2. **Stat floor and reporting.** Store the configured raw reward/penalty and the *effective applied delta*. On a stat of 0, a configured −1 outcome remains a recorded negative outcome, but the effective stat change is 0. Daily gained/lost/net and displayed stats use effective deltas; explain limited penalty in the System result. Positive XP is based on positive points actually awarded, not net signed total. Use deterministic ordered replay after corrections to respect floors.
3. **Late-completed tasks and corrections.** Preserve three distinct facts: (a) scheduled occurrence date, (b) actual activity/completion date (entered by the user for late completion), and (c) timestamp of logging/correction. Award/report quest and hobby effects on the **actual activity date**; use scheduled date to determine occurrence identity, due logic and streak eligibility. Historical backfill is always ineligible to restore a broken streak. Sleep alone uses its sleep-night date. If users change actual completion date, reattribute the record in reports without duplicating effects.
4. **Cross-device consistency.** The server is authoritative. Unique occurrence IDs / database uniqueness constraints ensure one award per occurrence, using atomic database transactions/RPC and versioned writes. If two devices edit the same outcome concurrently, the second must re-fetch and ask to reconcile, not silently overwrite or credit twice.
5. **Data recovery.** In v1 provide an authenticated full-history JSON export with schema version and timestamps. Supabase database backup/recovery process documented. Don't expose exports via public URLs and don't claim an automatic backup exists unless configured. Restore/import can be later phase; keep schema export-ready.
6. **Production login.** One email/password owner account, signup disabled after provisioning; authenticated ownership enforced with RLS even for single user. Don't ship credentials, service-role key, or data in the frontend.
7. **Network behavior.** Online-first. Installable PWA may cache application shell/previously viewed screens, but edits require connectivity. Communicate offline/read-only state, failed writes, syncing and data freshness. Do not enqueue invisible offline edits in v1.
8. **Persistence of theme and report dismissal.** Theme selection stored in the user's profile and cached locally as a non-authoritative UI preference. Default for new profile = `inked-fantasy`. Report-dismissed marker is stored account-side by *quest-day key* so opening a second device does not automatically reopen the same daily report.
9. **Last-valid-date rule.** Monthly schedules targeting day 29/30/31 fall on the last valid date in shorter months. Yearly Feb 29 schedules fire Feb 28 in non-leap years. Dates interpreted in the account time zone.
10. **Streak correction dependency.** Reversing an incorrect occurrence reverses that occurrence's own streak bonus and XP. If subsequently awarded streak bonuses were dependent on the invalid occurrence, compensate/withdraw those illegitimate bonus awards; do **not** create or restore any streak bonuses from backfilled history. Recalculate current streak prospectively, never grant retroactive milestone bonuses. The ledger must be auditable.
11. **Task config versions.** Editing names/weights does not rewrite historical snapshots. Schedule changes reset active streak. No quest type changes after creation. Historical effects are based on the saved configuration at recorded occurrence, not the latest quest definition.
12. **No mandatory daily penalty.** Missing an activity remains unreported (and breaks its streak if applicable). Nothing negative is awarded merely for inactivity or forgetting.

## Explicit tradeoffs / deferred design choices

- **Quests filters:** start with the quest-day subtitle, no mandatory All/Pending/Done controls; add if usability tests show a need.
- **Calendar selected-day preview:** inline on phone, persistent pane on iPad. Expanded Day Details retains Stats/Sleep and corrections.
- **Overdue labels:** small muted negative-color outlined tag.
- **Status XP sparkline:** not part of v1.
- **Theme difference:** Inked Status may center the name and hero level; OLED Status uses A+C top/upper-right Energy placement. Energy remains clearly visible in both.
- **"Adventurer" subtitle in Inked mocks:** cosmetic only, **omit by default** because player ranks were excluded.
- **Sleep-record correction after missing:** user may log previous night later; it updates sleep-night stat data, next-day Energy and historical reports without changing a regular quest streak.
- **Fine UI details:** default to semantic accessible controls and useful touch target dimensions over literal miniature mockup hitboxes.

## Outside v1

No full expense ledger, YouTube analytics, actual bank balance, HP/MP, quantified fatigue, player rank system, avatars, social sharing, offline edit queue, push notifications, payment system, automatic sensor sync, per-hobby progress %, "every N weeks", or X/week quotas.
