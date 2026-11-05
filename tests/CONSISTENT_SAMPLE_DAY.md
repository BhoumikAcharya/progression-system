# Standardized visual fixture — Wednesday, 4 November 2026

Use this sample consistently in **all new screenshots**, sample seed data and acceptance tests. Older design boards contain arithmetic and date-label typos and are unchanged intentionally as original design references.

## Opening state

Previous stats assume VIT>=1, DIS>=1, BNK>=1 before negative events, so no floor effects limit this fixture. Quest streak for Nighttime Routine is due for a third-completion bonus.

## Recorded events

| Occurrence | Actual effective changes | Gross gained | Gross lost | XP |
|---|---|---:|---:|---:|
| Gym Workout | STR +2, VIT +1 | 3 | 0 | 450 |
| Read 20 Minutes | INT +1 | 1 | 0 | 150 |
| Nighttime Routine (base DIS +1, third-completion bonus DIS +1) | DIS +2 | 2 | 0 | 300 |
| Daily Expenses? = No | BNK −1 | 0 | 1 | 0 |
| **Totals** | **STR +2, INT +1, VIT +1, DIS +2, BNK −1** | **+6** | **−1** | **+900** |

Net stat points **+5**. Total positive points 6 ×150 =900. Calendar date is Wednesday, Nov 4, 2026, not Tuesday.

This illustrative fixture contains **four recorded quests**. If a UI wants a `5/8` quest completion example, it must seed a fifth genuinely completed quest with its own effects (possibly zero-effect); don't mismatch counted occurrences and listed records. Sleep category/energy should be seeded explicitly if displayed.

## Level transition verification

Transition costs sequence: 400, 460, 529, 609, 701, 807, **929**, 1069. Level 7→8 requires 929 XP for the transition; a sample progress of `540/929` has `389 XP` remaining. These transition values are not cumulative XP totals.
