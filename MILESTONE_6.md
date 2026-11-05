# Milestone 6 — Accessibility, export and PWA readiness

## Implemented

- Settings can download an authenticated, schema-versioned JSON export of all private account tables, including full audit and ledger history. A server function checks `auth.uid()` and returns only that owner's rows. The no-credentials preview gives no false export or sync success.
- Installable PWA manifest, 192/512 icons generated from the existing SVG, production service worker, and an offline app shell. The worker caches only same-origin shell/assets; private Supabase responses and writes are never cached or queued. Offline saves still fail visibly.
- Initial keyboard focus keeps the skip link reachable. Navigation and stat stepper targets meet 44 CSS pixels; text inputs use at least 16px; reduced-motion behavior and both themes are covered by browser checks.
- Browser suite covers six routes, themes, phone/iPad layouts, Calendar/report navigation, editors, empty/archive/sleep states, 320px overflow, keyboard entry, touch targets, reduced motion, manifest and truthful backup preview. A separate production-build browser test verifies offline shell loading and no-save behavior.

## Verification

- `npm run check`: lint, strict TypeScript, 33 unit tests, database migrations/transaction smoke tests through `202611050019`, and production build.
- `npm run test:e2e`: 52 Chromium checks across phone/iPad and Inked/OLED projects.
- `npm run test:pwa`: production build and one offline installation/browser check.
- `npm run format:check` and `git diff --check` passed.

## Remaining limits

- Live Supabase integration with two authenticated devices remains untested because this repository has no project credentials. A browser download against a real authenticated account and large-history performance should be checked before relying on export for recovery.
- JSON import is not implemented. Database backup scheduling and restore testing must be configured on the selected Supabase plan; see [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md). No automatic backup is claimed.
- The local PWA test proves Chromium installation plumbing and offline shell behavior; actual iOS/iPadOS install behavior and production HTTPS hosting require device testing after deployment planning. Hostinger has not been configured.
