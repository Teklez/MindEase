# E2E Tests

Playwright-driven end-to-end tests for MindEase. They run against the full
Docker Compose stack (`frontend`, `backend`, `db`) — no mocks.

## Layout

```
e2e/
  fixtures/         Custom Playwright fixtures (api client, authed page)
  helpers/          Pure helpers (env, api wrapper, user factory, auth seeding)
  pages/            Page Objects — one per route, all extend BasePage
  tests/            Specs, grouped by feature (auth/, dashboard/, …)
  tsconfig.json     Inherits the frontend tsconfig
  .artifacts/       Test results + HTML report (gitignored)
```

Three rules keep this tidy as it grows:

1. **Specs import from `fixtures/*`**, never `@playwright/test` directly.
   That way every test gets the `api` helper for free and we can add new
   shared concerns (logged-in user, locale switcher, etc.) without
   touching specs.
2. **Selectors live on Page Objects**, never inline in specs. If a
   component is rewritten, you change one file.
3. **One test = one fresh user.** The `authenticated` fixture mints a new
   user per test via the backend so parallel runs never collide.

## Run

```bash
cd frontend

# one-time: install browser binaries
npm run test:e2e:install

# stack must be up first
( cd .. && docker compose up -d )

npm run test:e2e             # headless, both browsers
npm run test:e2e:ui          # Playwright UI mode (great for debugging)
npm run test:e2e:headed      # see the browser
npm run test:e2e:report      # open the last HTML report
```

## Config knobs (env vars)

| Variable        | Default                 | Purpose                          |
| --------------- | ----------------------- | -------------------------------- |
| `E2E_BASE_URL`  | `http://localhost:3000` | Frontend origin                  |
| `E2E_API_URL`   | `http://localhost:8000` | Backend origin (used by fixtures) |
| `CI`            | unset                   | Enables retries + `forbid.only`  |

## Adding a test

1. If the route is new, add `pages/foo.page.ts` extending `BasePage`.
2. Drop the spec in `tests/<feature>/foo.spec.ts`.
3. Pick a fixture import:
   - `fixtures/base` for anonymous flows.
   - `fixtures/authenticated` when the user must already be signed in.
