# FindMe — Handoff

Read this first, then [CLAUDE.md](CLAUDE.md) (the spec) and [PROJECT_PLAN.md](PROJECT_PLAN.md) (the checklist).

**Last updated:** 2026-11-03. **Current position:** Phase 1 is complete locally. Phase 2 has not started.

## State of the project

- **Nothing is committed.** `git init` has run on `main`, but no commit has been made, because none was requested.
- **Nothing is deployed.** There are no Supabase, Vercel, Google, Razorpay or Resend accounts or credentials.
- **What works, on the local stack only:** registration with consent, email confirmation, login and logout, password reset, username claim, account settings, protected routes, suspension lockout, and rate limiting.
- **Written but never run:** Google OAuth. It needs credentials, and its button stays hidden until `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

## Running it

Docker Desktop must be running. It's installed at `%LOCALAPPDATA%\Programs\DockerDesktop\`, not the usual path.

```bash
npx supabase start      # the local stack, with images already downloaded on this machine
npm run dev             # http://127.0.0.1:3000; emails appear at http://127.0.0.1:54324
```

`.env.local` is gitignored and holds local-only keys from `npx supabase status -o env`. If the file is missing, rebuild it from `.env.example` and that command.

## Verifying

```bash
npm run check                         # lint, types, unit and DB tests, build
npm run build && npm run test:e2e     # needs the local Supabase stack
```

Last results: lint and types clean; 171 unit, component and DB tests passing; production build passing; 32 of 32 Playwright tests passing against local Supabase, with no server log errors. After the final dependency move, the build and unit tests were re-run in full and E2E only as a smoke test.

## Things that will catch you out

1. **Next.js 16 differs from older knowledge.** Read `node_modules/next/dist/docs/` before relying on memory. `middleware` is now `src/proxy.ts`.
2. **`next.config.ts` carries the Tailwind loader.** There is no `postcss.config`. Removing the `turbopack.rules` entry silently disables all styling, and the logic tests still pass.
3. **Cache Components is on.** Anything reading request data must sit behind `<Suspense>`, or the build fails. Don't read the session at the top level of a layout. `getCurrentUser` awaits `connection()` first; don't remove that, because it prevents both a static signed-out page and `Date.now()` errors in the server log during prefetch.
4. **Check the route table after building.** Protected routes must show `◐`, never `○`.
5. **Watch server logs during E2E.** Tests can pass while the server logs errors.
6. **`NEXT_PUBLIC_*` values are fixed at build time.** Rebuild after changing them, including before E2E runs.
7. **Use `127.0.0.1`, not `localhost`,** so the origin matches `NEXT_PUBLIC_APP_URL` and cookies line up.
8. **Supabase default privileges grant `anon` and `authenticated` access to new functions and tables.** Every new object needs an explicit `revoke`, and `tests/db/harness.ts` reproduces those defaults so a test can catch a miss. Add new tables and functions to the tests.
9. **New top-level route?** Reserve its name in `src/features/usernames/reserved.ts` and in a new migration. A test fails otherwise.
10. **Never edit an applied migration.** Write a new one.
11. **E2E needs local limits.** `supabase/config.toml` raises the auth limits for the local stack only. Production settings are in DEPLOYMENT.md.

## Decisions taken without asking

The user may want to revisit these:

- `git init` was run; nothing was committed.
- Merged `links` and `content_blocks` into a planned `blocks` table, and other merges listed in DATABASE_SCHEMA.md.
- Password minimum of 10 characters.
- Postgres-backed rate limiting, to avoid a new vendor.
- Blocked-username lists in `reserved.ts`, including a short list of offensive words. Please review them.
- Draft Privacy and Terms text, written by Claude and **not legally reviewed**. Pages are clearly marked as drafts.
- Node 22.12+ set in `engines`, to suit the Vitest 5 and Vite 8 toolchain. Only Node 24 has actually been run.
- Light theme only. The dark palette from shadcn was removed.

## Open questions for the user

See PRD.md section 8. The most pressing are whether `findme.com` is obtainable and a trademark check on the name, since both affect branding work in Phase 2.

## Next step: Phase 2

Suggested order, each with tests:

1. Migrations for `blocks`, `social_links`, `theme_presets`, and storage buckets.
2. Dashboard shell with the full navigation, adding each item as its page ships.
3. Link manager, with URL scheme validation first.
4. Social links.
5. Public profile at `/[username]`, using `use cache` and `cacheTag`; core themes; publish and unpublish.
6. Full onboarding wizard, extending `src/app/onboarding`.
7. Marketing pages, then sitemap and robots.

Do this before adding user content tables: close the RLS gap noted in SECURITY.md under known gaps, where suspended accounts can still write through the API.
