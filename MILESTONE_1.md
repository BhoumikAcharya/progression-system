# Milestone 1 — Application Foundation

Implemented for local UX review. No deployment or production credentials were used.

## Architecture and changed files

- `src/app/`: React Router routes, responsive shell, persistent six-tab navigation, offline banner, local preferences context and fail-closed private-route placeholder.
- `src/components/`: shared page headers, sections, empty states, segmented controls, menu rows and five-attribute display.
- `src/features/`: all six destinations, local preview player-name setup, Settings, Sleep Log, archives and guide. Calendar browsing supports real dates, monthly/weekly/daily modes, Stats/Sleep selection and phone inline / iPad side-pane detail.
- `src/themes/`: shared semantic tokens, default Inked Fantasy and selectable OLED Black. Theme and preview name persist locally; storage failures are reported truthfully.
- `src/domain/` and `src/data/`: typed entities, ledger and repository contracts, pure level transition utility, and explicit Milestone 2 scheduling/progression TODOs. No reward or activity persistence is fabricated.
- Root configuration: Vite, strict TypeScript, Tailwind, ESLint, Prettier, Vitest, Playwright, lockfile, safe ignore rules, `.env.example`, app HTML/icon and GitHub Actions checks.
- `README.md`: appended local setup and scope instructions; original handoff text retained.
- `tests/e2e/`: responsive smoke tests and screenshot capture in four phone/iPad/theme projects.

All 32 original files covered by the handoff checksums under `docs/`, `design/`, `prompts/`, the sample fixture, and `AGENTS.md` match their original hashes. No design source or board was modified.

## Validation actually run

| Command | Result |
| --- | --- |
| `npm run lint` | Passed, no warnings |
| `npm run typecheck` | Passed |
| `npm test` | 4 files, 15 tests passed |
| `npm run build` | Passed; production output in `dist/` |
| `npm run format:check` | Passed |
| `npx playwright install chromium` | Browser installed |
| `npm run test:e2e` | 28 passed across phone/iPad and both themes |
| `npm audit` / install audit | Final dependency audit: 0 vulnerabilities |
| Handoff checksum verification | All 32 original reference/instruction/fixture files matched |

Browser checks cover routes, correct navigation order, empty initial stats, persisted theme and name, calendar browsing, narrow 320px layout, tablet split panes, offline messaging, and redirecting the private route to the authentication placeholder. They do not claim server authentication/RLS coverage. Screenshots were visually inspected for both themes and phone/tablet layouts. Generated screenshots and browser reports are ignored under `test-results/` and `playwright-report/`.

Initial dependency downloads and local server/browser access required sandbox escalation. The first browser attempt ran before the headless browser installation completed; the subsequent full runs passed. The initial formatter lacked an SVG parser; an explicit HTML parser override fixed it. Dependency audit findings were resolved by updating Vitest and overriding the linter's minimatch dependency to patched 11.x; lint and all checks passed with that override.

## Visual decisions

The layouts follow the supplied HTML/CSS and boards: warm brass/serif character sheet, neutral OLED alternate, restrained separators, grouped Sleep card, plain Hub/settings/archive rows and centered six-tab footer. No fake phone chrome, ranks or example reward totals were copied. Secondary text is brighter and small controls/text are larger than the miniature mockups for readability. iPad uses side-by-side Status, quest list/editor placeholder and calendar/detail panes.

## Intentional remaining work

This milestone is an empty local preview. Theme and player name are the only persisted values. The private data area stays inaccessible; genuine sign-in and owner authorization are not implemented. There is no activity write, sleep save, quest editor logic, To-Do editing, reward accounting, export, sync, automatic report, PWA installation/cache or deployment. Static Sleep category descriptions and editor outlines are labelled as previews and do not record data.

Next is Milestone 2: pure XP/stat/streak/recurrence/03:00 logic, floor-aware replay and correction dependencies; Supabase schema, owner auth/RLS, unique occurrences, versioned transactional RPCs, reconciliation and database concurrency/ownership tests. Do not proceed before this foundation's UX review.
