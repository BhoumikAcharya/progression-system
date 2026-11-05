# Connected-account integration readiness

This follows the six numbered implementation milestones. It does not configure a production project or deploy the app.

## Completed locally

- Signed-in profile name and theme are now loaded from the server; the local theme value is a startup cache. Settings writes only the changed profile field, confirms the server response before reporting success, and restores the prior theme if an online write fails. Offline preference writes fail visibly.
- Sign-in hands the verified session to the route gate before navigating to Status. Settings can sign out and immediately close private routes. A connected-mode browser fixture exercises login, server-owned theme after a stale local cache, name save, offline theme rollback, sign-out and route protection using mocked Supabase responses.
- Embedded PostgreSQL checks confirm an authenticated owner can update their profile and cannot update another owner's row. Unit tests confirm preference writes send only the selected column.

## Live validation still required

There is no `.env.local` in this checkout. The connected-mode browser fixture is a contract test, not a live Supabase test. Before using personal data, connect an isolated private Supabase project with all migrations through `202611050019` applied, one manually provisioned test account, and public URL/publishable key only in `.env.local`. Disable public signup in the project settings. Then verify sign-in, profile/theme sync across two separate authenticated browser sessions, quest and hobby collision behavior, history/report reads, export download, RLS denial from a second account, and sign-out/session expiry. Do not put passwords, database URLs, or service-role keys in `VITE_` variables or Git.

Run `npm run check`, `npm run test:e2e`, `npm run test:pwa`, and `npm run test:connected` locally. The latter uses a mock server and does not need credentials. A live two-session integration test cannot be honestly marked passed until a private development project exists.
