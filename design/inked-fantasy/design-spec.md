# Progression System — Design Specification (Inked Fantasy)

> Handoff spec for downstream agents. Describes the **Inked Fantasy** skin of Progression
> System. The information architecture, screens, states, and mechanics are **identical to
> the base A+C build** — only the visual language changes. The four rendered HTML mockups
> (`ink-01…ink-04`) are the exact source of styling values; read this for intent, the HTML
> for pixels.
>
> Product: a Solo Leveling–inspired, mobile-first habit-tracking / life-gamification PWA
> (phone + iPad). Theme direction: **Inked Fantasy** — a refined tabletop-RPG character
> sheet, not a video-game HUD.

---

## 1. Theme philosophy

A quiet, premium character sheet. Warm near-black, a **single brass/gold accent**, an
**elegant serif for every meaningful numeral and title**, and **thin rune-like dividers used
sparingly** (Status only). It should feel personal and timeless rather than techy, and stay
calm after months of daily use. Discipline carried over from A+C: hairlines over boxes,
honest numbers, no avatar, no rank, cards only where they group an interaction.

---

## 2. Design tokens (Inked Fantasy)

### Color
| Token | Hex | Use |
|---|---|---|
| `page` | `#100e09` | Page backdrop behind device frames |
| `bg` | `#13110c` | App background (warm near-black) |
| `surface` | `#1a160f` | Elevated cards (quests, hobbies, sleep) |
| `line` | `rgba(201,169,106,.22)` | Borders / dividers (brass-tinted) |
| `line-soft` | `rgba(201,169,106,.12)` | Hairline row dividers |
| `accent` (brass) | `#c9a96a` | Level, XP, icons, chevrons, Save fill, active nav, checkbox fill |
| `text` | `#efe7d4` | Primary warm off-white |
| `muted` | `#8f8468` | Labels, secondary text |
| `faint` | `#6b6350` | Tertiary, inactive nav, zero/future values |
| `pos` | `#a9c187` | Positive stat values & rewards (muted, palette-harmonised) |
| `neg` | `#cd9a82` | Negative values, overdue, recorded-negative |

**Accent discipline:** brass is reserved for *the System* — level, XP, section accents, the
Save button, active nav, the checkbox fill. It is **not** used for +/− stat values; those use
the muted `pos`/`neg`. On dark fills (Save button, filled checkbox, active segment) text/icon
flips to `#13110c`.

### Typography
Two families:
- **Serif display:** `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`.
  Used for page titles, player name, the big level numeral, **all stat values and key
  figures** (XP, net, gained/lost, calendar net values, stepper values, Morning-Report XP).
- **Sans body:** system sans. Used for labels, task/quest titles, descriptions, and all
  long-form text (keeps legibility — serif is for numerals and headings, not paragraphs).

| Role | Size | Family / weight |
|---|---|---|
| Hero numeral (level, report XP) | 50–54px | serif 500 |
| Page title | 27px | serif 500 |
| Stat value (Status) | 21px | serif 500 |
| Section label | 10px | sans 600, UPPERCASE, +0.2em tracking, muted |
| Task / row title | 14.5–15.5px | sans 500 (hobby/hub/archive titles use serif) |
| Reward / penalty | inherit | colored pos/neg |

### Shape, spacing, icons
- Cards: `surface` bg, 1px brass-tinted border, radius **12**.
- Dividers: 1px `line-soft`. **Rune dividers** (`◆` / `❖` centred in a gold gradient hairline)
  only on Status and the Morning Report — never on dense screens (Quests, Calendar, editors).
- Checkbox: brass outline, radius 5; checked = brass fill with `#13110c` check.
- Buttons/Save/FAB: **filled brass**, dark text/glyph. FAB 52px circle.
- Device frame bezel warms to `#211c12`.
- Icons: monochrome **brass** outline (stroke 1.4–1.6), same five stat glyphs + nav set as base.
- XP bar: 2px brass fill on a faint track, with a small brass diamond marker at the fill head
  (Status). Calendar "today" ringed brass; selected day warm-filled `#201a11`.

---

## 3. Screens & states
Unchanged from the base spec — see the base `progression-system-design-spec.md` §4 for the
full screen-by-screen breakdown and §5 for the mechanics→UI invariants (XP = 150×positive
points; levels never fall; Energy is a text condition; per-quest streaks only; 3 AM reset;
corrections reverse a wrong positive's XP but not a broken streak; stat floor 0; BNK is
gamified). The Inked skin changes none of it. Quick theme-specific notes:

- **Status** — the showcase: centred serif name, large brass level numeral, rune dividers
  between XP / Attributes / Today. The only screen that leans into ornament.
- **Quests / editors / calendar / archives** — ornament-free; theme carried by surface
  warmth, brass accents, and serif numerals only.
- **Morning System Report** — no nav; serif XP hero framed by two rune dividers; quiet results
  table. Special through composition, not graphics.
- **To-Dos** — deliberately the plainest; theme shows only in the brass add-plus and chevron.
- **iPad** — Status side-by-side, Quests master-detail (editor as right pane), Calendar with a
  persistent Day Details pane. Same records, no new features.

---

## 4. Open decisions (same as base, confirm before building)
1. Quests filters shown as a quest-day subtitle (not a filter bar).
2. Calendar day summary inline on phone / persistent right pane on iPad (not a bottom sheet).
3. Overdue hobby tasks → small outlined `neg` tag.
4. Status XP sparkline (C's idea) **not** included — Status kept present-tense.

---

## 5. Handoff notes
- Mockups: `ink-01-main-screens`, `ink-02-editors`, `ink-03-supporting`, `ink-04-ipad` —
  self-contained HTML/CSS, no framework. Read them for exact values.
- Production serif: the stack above renders with Iowan/Palatino/Georgia; for a tuned result
  pick a licensed serif with good numerals (e.g. a transitional/old-style face). Sans body can
  stay Inter / system.
- Nothing in the mechanics changed; anything beyond the brief is flagged in §4.
- Target: PWA, mobile-first, responsive to iPad via the two-pane patterns.
