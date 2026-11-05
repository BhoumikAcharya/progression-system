# Progression System — Design Specification (Direction A+C)

> Handoff spec for downstream agents. This document describes the **design idea**: the
> visual language, the reusable components, every screen and its states, and the
> interaction decisions. It is the source of *intent*. The five rendered HTML mockups
> are the source of *exact values* (every hex, size, and state is in their CSS) — read
> both: this file for structure and rationale, the HTML for pixel-precise reference.
>
> Product: **Progression System** — a Solo Leveling–inspired, mobile-first habit-tracking /
> life-gamification PWA (phone + iPad). Chosen direction: **A+C** — minimal/typographic
> restraint (A) with generous editorial spacing (C). OLED-black, Notion-like restraint.

---

## 1. Design principles

1. **Typography and dividers create hierarchy — not boxes.** Cards appear *only* where they
   group an interaction (quest cards, hobby cards, the sleep check-in). Everything else uses
   hairline dividers and whitespace.
2. **OLED-black, near-monochrome.** Color is reserved to communicate *actual* stat changes.
3. **One-tap recording.** Completing a task is one tap; feedback renders *inside the card*,
   never in a modal.
4. **Honest representation of state.** Unreported ≠ failed. A missing record is visually
   distinct from a zero day and from a negative day.
5. **No RPG kitsch.** No avatar, no rank badge, no HP/MP, no glow, no progress bars on hobbies.

---

## 2. Design tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `bg` | `#000000` | App background (OLED) |
| `surface` | `#0c0c0e` | Elevated cards (quests, hobbies, sleep) |
| `line` | `#1b1b1e` | Borders, strong dividers, nav top-border |
| `line-soft` | `#161619` | Hairline dividers between rows |
| `text` | `#f3f3f4` | Primary text, values |
| `muted` | `#85858b` | Secondary text, labels |
| `faint` | `#55555a` | Tertiary text, inactive nav, zero values |
| `pos` | `#76c698` | Positive stat values & rewards ONLY |
| `neg` | `#d98f8f` | Negative stat values, overdue, recorded-negative ONLY |

**Accent rule:** `pos`/`neg` hue appears only on live +/− stat values, in-card reward/penalty
messages, calendar day-state values, and the overdue tag. All structure, icons, and chrome
stay monochrome.

### Typography
Production typeface: **Inter** or **Geist** (clean modern sans, strong tabular numerals).
Mockups use a system sans fallback.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title | 26px | 300 | letter-spacing −0.02em |
| Hero numeral (level, report XP) | 46–52px | 200 | letter-spacing −0.03em |
| Section label | 10px | 600 | UPPERCASE, letter-spacing 0.16–0.18em, `muted` |
| Task / row title | 14.5–15px | 500 | |
| Core stat value | 20px | 300 | |
| Supporting / meta | 11–12.5px | 400 | `muted` |
| Reward / penalty value | inherit | 600 | colored `pos`/`neg` |

### Spacing, radius, icons
- Content padding: **20–24px** horizontal. Generous vertical rhythm (C influence).
- Dividers carry **18–22px** margin top/bottom.
- Radius: cards **13–14px**, inputs/pills **10–12px**, checkbox **6px**, FAB **50%**.
- Icons: **monochrome white outline**, stroke **1.4–1.6**, size **20–24px**. No filled or
  multicolor icons. No icon per hobby/to-do row.

### Stat icons (the five permanent attributes)
| Stat | Abbr | Icon |
|---|---|---|
| Strength | STR | dumbbell / barbell |
| Intelligence | INT | open book |
| Vitality | VIT | heart |
| Discipline | DIS | shield |
| Bank | BNK | wallet |

### Bottom navigation (fixed, six, in order)
`Status · Quests · To-Dos · Calendar · Hobbies · Hub` — outline icons:
activity (Status), check-square (Quests), list (To-Dos), calendar (Calendar),
compass (Hobbies), grid (Hub). Active = `text`, inactive = `faint`. Visible on all
ordinary screens; hidden only on the Morning System Report.

---

## 3. Core components

- **Checkbox** — 20px square, 1.5px `faint` border, radius 6. Checked: filled white, black
  check. Small variant 16–17px for subtasks and Volatile outcomes.
- **Quest card** — `surface` bg, 1px `line` border, radius 14, padding ~15px. Completed state:
  `opacity 0.45` (grey out in place). Contains an in-card **System message** area (top-bordered
  hairline) showing exact stat deltas (colored) + XP (white) + streak note.
- **Volatile control** — two labelled outcome checkboxes side by side; both empty by default
  (unreported). Selecting one records it, greys the card, shows the result.
- **Routine subtasks** — small checkboxes in a hairline-separated list inside the parent card.
  Only the parent carries a reward.
- **Stat stepper** (editor) — one row per stat: icon · name/abbr · `[−]` · signed value · `[+]`.
  Value colored `pos` when >0, `neg` when <0, `faint` when 0. Stacked vertically (never a
  cramped 5-column grid).
- **Segmented toggle** — e.g. Stats / Sleep; active segment filled white.
- **Schedule picker** — pill row: Every Day · Days · Monthly · Yearly · Once. Selecting "Days"
  reveals a Mon–Sun chip selector.
- **Sleep options** — three mutually-exclusive cells: 9–11 PM · 11 PM–1 AM · After 1 AM, each
  showing its resulting Energy.
- **FAB** — 52px white circle, `+`, bottom-right above nav. On Quests only.
- **List rows** (Hub, archives, settings) — divider-separated, title + short description +
  chevron or action; no tile grid, no per-row icons.

---

## 4. Screens

### Main navigation (6)
- **Status** (home) — top: `SYSTEM` overline, editable player name, Level, Energy (text, upper
  right; never a meter). XP section: `current/threshold`, thin progress bar, "N to Level X".
  Core Stats: single horizontal row of five (icon · abbr · value). Today at a Glance: XP today,
  quests cleared, points gained (`pos`), points lost (`neg`), active per-quest streak roll-up.
  No avatar, no rank, no activity feed.
- **Quests** — title + quest-day subtitle; Sleep Check-In card near top; scrolling list of
  Standard / Volatile / Routine cards; completed cards greyed in place with in-card results;
  FAB to add.
- **To-Dos** — Keep-like. Inline add field; standalone checkboxes; one level of nesting
  (checking all children completes the parent); inline collapsible Archive. No stats, dates,
  XP, or category icons.
- **Calendar** — Monthly (primary) / Weekly / Daily; Stats / Sleep toggle. Month grid: each
  day shows date + net points with four distinct states — gain (`pos`), loss (`neg`),
  zero (`faint` 0), unreported (`faint` –). Selecting a day opens an inline summary (gained,
  lost, net, XP, stat deltas, key activities, View Details).
- **Hobbies** — expandable hobby cards: name, active status, live subtasks (each with its own
  stat effect), overdue tag, next scheduled item, finish reward, ⋮ menu. No progress bars /
  percentages. No Add Hobby button (created from the Quests +). Empty: "All wrapped up for now.
  Schedule more tasks."
- **Hub** — divider menu, grouped: Tools (Sleep Log) · Archives (Quest / Hobby / To-Do) ·
  Settings.

### Add / Edit Quest (shared page, 4 type variants)
OLED-black, dividers not cards, prominent Save pinned above nav. Type selector upper-right;
**locked when editing** (title becomes "Edit Quest"). Variants:
- **Standard** — name, description (optional/collapsed), schedule, five-stat stepper, live XP
  preview (150 × positive points).
- **Volatile** — two editable outcome labels via a compact outcome selector (avoids showing 10
  stat rows); each outcome its own stepper and XP preview.
- **Routine** — editable subtask list (add/rename/remove/reorder) + parent-level stepper; XP
  awarded only when all subtasks checked.
- **Hobby** — name, description, individually scheduled subtasks (each own schedule + effects),
  one-time finish reward (default INT +5). Reached from Quests +.

### Supporting
- **Sleep Log** (Hub) — single column like Add Quest: sleep-night date selector, three bedtime
  categories, Energy + stat + XP preview, Save, recent nights (tap to correct).
- **Morning System Report** — full-screen, **no nav**, once per quest day. Results-only: `SYSTEM
  REPORT` overline, date, hero XP numeral, gained/lost/net/quests/Energy rows, five-stat deltas,
  streak milestone, "Continue to Player Status". No scenery, no animation.
- **Calendar Day Details** — back · title · date · prev/next · Stats/Sleep. Stats mode: three
  indicators (gained/lost/net), XP, five-attribute breakdown, recorded quests with each
  outcome/reward, Correct Entries + System Report actions. Volatile negatives shown as
  **RECORDED**, not unreported. Correction controls stay hidden until requested.
- **Quest Archive** — two sections: Archived (Restore) · Completed one-time (view-only). No bulk
  clear.
- **Hobby Archive** — Paused (Restore) · Finished (permanent). Plain rows.
- **Settings** — divider menu: Player Profile · Appearance (dark, fixed) · System Rules & Guide
  (read-only) · Data & Backup (sync, export). Nothing invented beyond the brief.

### iPad
Same records and destinations; width spent on fewer taps and more context, not new features:
- **Status** — stats and Today at a Glance side by side; whole dashboard visible without scroll.
- **Quests** — master-detail: quest list left, Add/Edit editor as a right pane (no full-screen
  takeover).
- **Calendar** — month grid left, Day Details as a persistent right pane (replaces the phone's
  inline/bottom-sheet summary).
Bottom tab bar centered (not stretched). No side-rail / new nav complexity.

---

## 5. Mechanics → UI mapping (invariants the UI must honor)

- **XP** = 150 × each positive point awarded; negatives never deduct XP. Show the derivation in
  previews ("3 positive points × 150").
- **Level** never decreases; corrections can lower XP totals but never revoke an achieved level.
  Thresholds: first 400, then `ceil(prev × 1.15)` per transition.
- **Energy** is a derived daily condition (Excellent / Medium / Low / –) from the prior sleep
  night — text only, never a numeric meter.
- **Streaks** — per-quest only; every 3rd consecutive completion adds +1 in each affected stat's
  own direction (applies to negative streaks too). Any aggregate shown on Status/Report is a
  roll-up of per-quest streaks — **never invent a single global streak**.
- **3:00 AM reset** closes unreported occurrences (no effects) and breaks their streaks.
- **Corrections** reverse a wrongly-awarded positive (and its XP) but cannot restore a broken
  streak. Config edits apply prospectively; history keeps its original reward definitions. Type
  is locked on edit.
- **Stat floor** = 0, no ceiling. BNK is gamified, not real money.

---

## 6. Open decisions (visual choices made on brief-flagged items — confirm before building)

1. **Quests filters** — shown as a quest-day subtitle rather than a filter bar. (Could add
   All/Pending/Done behind a small control.)
2. **Calendar day summary** — opens *inline* under the grid on phone (persistent right pane on
   iPad), not a bottom sheet.
3. **Overdue hobby tasks** — small outlined `neg` tag.
4. **Not adopted into canonical set:** C's 30-day XP sparkline on Status (brief says Status has
   no activity feed; kept present-tense). Available if wanted.

---

## 7. Handoff notes

- **Mockups are static HTML/CSS**, self-contained, no framework — read them directly for exact
  values. Phone frames ~384px; iPad frames two-pane landscape.
- **No mechanics were invented.** Anything beyond the brief is flagged in §6 and on the frames.
- Target: **PWA, mobile-first**, responsive up to iPad via the two-pane patterns in §4.
- This spec is stack-agnostic — it specifies *what and why*, not a component framework.