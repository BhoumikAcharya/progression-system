# Dual-theme visual system — normative design integration

## Canonical visual resources

- **Default: Inked Fantasy:** `design/inked-fantasy/design-spec.md`, 4 `.html` source mocks and matching `.png` boards. Warm near-black, subdued brass, refined serif heading/numeral scale; rune-like dividers only on Status/Morning Report.
- **Alternative: OLED Black:** `design/oled-black/design-spec.md`, 5 `.html` source mocks and matching `.png` boards; minimal A+C style, pure black and monochrome chrome, thin dividers, muted positive/negative accents.

**Both must be available under Hub → Settings → Appearance → Theme.** Both implement same screens, routes, data, control states and interactions. Theme changes must not reload page or mutate progression data. Persist setting to profile and non-sensitive local preview cache, with profile authoritative for cross-device sync.

## Principal token differences

| Semantic token | Inked Fantasy (default) | OLED Black |
|---|---|---|
| app bg | `#13110c` | `#000000` |
| surface | `#1a160f` | `#0c0c0e` |
| primary text | `#efe7d4` | `#f3f3f4` |
| subdued text | `#8f8468` | `#85858b` |
| accent | `#c9a96a` brass | `#f3f3f4` neutral |
| positive | `#a9c187` | `#76c698` |
| negative | `#cd9a82` | `#d98f8f` |
| normal dividers | `rgba(201,169,106,.12/.22)` | `#161619 / #1b1b1e` |
| display typography | Iowan/Palatino/Georgia serif fallback | Inter/Geist/system sans |
| body typography | system sans | Inter/Geist/system sans |

Do NOT distribute proprietary font files. System font fallbacks are acceptable. The exact HTML mocks are reference-only and contain static sample numbers and placeholder buttons.

## Style constraints

- Cards **only** for grouped activity interactions (quest, hobby, sleep). Hub, archives, settings, editors and status rely on spacing + dividers.
- Five stat glyphs: dumbbell STR, open book INT, heart VIT, shield DIS, wallet BNK; same icons across themes, colors controlled by token.
- Six tabs always shown in specified order (except Report). On Inked active nav/checkbox/save/FAB uses brass; on OLED these are white/neutral. Positive/negative always distinguishable by value + sign, not just color.
- Inked: meaningful numbers and page/hobby/archive titles use serif, body text sans; restrained rune dividers only Status and Report, no fantasy art/avatars/ranks.
- OLED: typography-first, minimal cards and no colored stat icon tiles; thin white XP bar and plain dividers.
- Group UI state follows parent behavior: completed quest becomes muted but **text/recorded effects stay legible**, never blanket opacity so low that result cannot be read.
- Status: OLED upper-right Energy; Inked centered Player Status with a clearly visible Energy text line (iPad Energy upper-right). Optional cosmetic `Adventurer` from Inked mock is **omitted** by default because the product explicitly excluded ranks.
- Quests: Sleep Check-In at top; Standard one checkbox, Volatile two, Routine children; in-card System message; floating `+` above tab bar.
- To-Dos: no category icons, no dates, just rows and checkboxes; expandable Archive.
- Calendar: net daily stat cells, Stats/Sleep switch, Monthly/Weekly/Daily; inline selected-day summary on phone, right detail pane on iPad; four distinct record states.
- Hobbies: parent cards with due/overdue subtasks, no progress bar; archived hobbies listed plainly with dividers.
- Editors: five stacked stat rows with − / + stepper and signed value, live XP preview, type dropdown locked on edit, pinned Save. Volatile config uses two outcome tabs to avoid ten rows at once.
- Report: full screen, no nav, minimal results-only with XP hero; Inked gets serif and sparing rune dividers; no scenic art, countdown, Today's Plan or elaborate animation.

## Responsive patterns

Phone 320–430 CSS px: scroll content, six-tab safe-area footer, concise labels, small-looking controls with proper hitboxes, no horizontal clipping, pinned footer respects virtual keyboard. iPad width: Status two columns (stats/XP left, Today right); Quests left list + editor right; Calendar grid left + details right. Maintain identical navigation labels and data across viewports. Respect orientation changes.

## Minimum usability corrections relative to static mocks

- Text in screenshots can be 9–11px: do not blindly copy unreadable size; use readable default >=12px where possible, form fields >=16px, and sufficiently contrasting secondary text.
- Buttons/checkbox tappable regions ideally >=44×44 CSS px even if 16–20px glyph displayed.
- CSS `:focus-visible`; semantic buttons/inputs; label and state exposed to screen readers; no exclusive long-press access to Edit/Archive/Delete.
- Remove any example sync timestamp unless real server status exists.
- In the mockups Level 7→8 wrongly shows 927 XP; correct mathematical requirement **929**. Mockups also have inconsistent gain/XP/date values. Use `tests/CONSISTENT_SAMPLE_DAY.md`, not copy numeric screenshot text literally.

## Implementation pattern

Suggested theme root `data-theme="inked-fantasy" | "oled-black"`; centrally defined semantic CSS properties: `--bg`, `--surface`, `--text`, `--muted`, `--faint`, `--border`, `--accent`, `--positive`, `--negative`, `--font-display`, `--font-body`. Tokens and modest theme-specific variants may change Status header composition, decorative rules, and serif use. Do not maintain duplicate business logic or separate copies of page components.

## Static screenshots are not executable screens

HTML pages embed phone/tablet frames purely to show layout. In implementation, omit device bezel and fake operating-system status bars; render real app content inside browser viewport/PWA window. Set real document title, manifest icons and proper browser safe-area paddings. Real dates and values must derive from data.
