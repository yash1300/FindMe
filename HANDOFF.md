# FindMe — Handoff

Read this first, then [CLAUDE.md](CLAUDE.md) (the spec) and [PROJECT_PLAN.md](PROJECT_PLAN.md) (the checklist).

**Last updated:** 2026-11-04. **Current position:** Phases 1–3 are complete on the local stack. Phase 4 (analytics) has not started.

## State of the project

- **Code:** on GitHub at <https://github.com/yash1300/FindMe>, a private repo. Phase 1 is on `main`; Phases 2–3 are on the `phase-2-3` branch, awaiting review and merge.
- **Nothing is deployed.** The user is about to add real credentials using [ENV_SETUP.md](ENV_SETUP.md).
- **Works on the local stack:** everything in Phases 1–3 except the items below.
- **Written but never run, because they need credentials:** Google sign-in and Resend email.

## Running it

Docker Desktop must be running. It's installed at `%LOCALAPPDATA%\Programs\DockerDesktop\`, not the usual path.

```bash
npx supabase start      # the local stack, with images already downloaded on this machine
npm run dev             # http://127.0.0.1:3000; emails appear at http://127.0.0.1:54324
```

`.env.local` is gitignored. If the user has switched it to their hosted project, swap the local values back in from `npx supabase status -o env` before running E2E tests. The tests refuse to run against anything else.

## Verifying

```bash
npm run check                         # lint, types, unit and DB tests, build
npm run build && npm run test:e2e     # needs the local Supabase stack, and port 3000 free
```

**Last results, and their limit.** There has been no single clean run of the whole browser suite since the last fixes, because the final run was stopped when the machine ran out of memory: 34 passed, 3 crashed (`Target crashed`, `worker process exited`), and 20 didn't run. Across the last runs, every one of the 57 tests has passed at least once, but not all on the final code. The changes since are small: no prefetch on the dashboard logo, and test fixes. **Run the full suite once on a machine with memory to spare, and close other apps first.** Lint, types and the production build passed on the final code; the 410 unit and database tests last ran just before the logo change.

## Things that will catch you out

1. **Next.js 16 differs from older knowledge.** Read `node_modules/next/dist/docs/` before relying on memory. `middleware` is now `src/proxy.ts`.
2. **`next.config.ts` carries the Tailwind loader.** There is no `postcss.config`. Removing the `turbopack.rules` entry silently disables all styling, and the logic tests still pass.
3. **`htmlLimitedBots: /.*/` in `next.config.ts` is what makes public pages return real 404s.** Remove it and unknown names return 200 again.
4. **Cache Components is on.** Anything reading request data must sit behind `<Suspense>`, or the build fails. Don't read the session at the top level of a layout. `getCurrentUser` awaits `connection()` first; don't remove that.
5. **Check the route table after building.** Protected routes must show `◐`, never `○`.
6. **Watch server logs during E2E.** Tests can pass while the server logs errors.
7. **Windows leaves `next start` running after Playwright exits.** `reuseExistingServer` is false for this reason, so a stale server fails loudly with "already used" instead of serving an old build. Stop the process on port 3000, checking first that it's this project's.
8. **Don't edit source files with PowerShell's `Get-Content`/`Set-Content`.** They read UTF-8 as Windows-1252 and add byte order marks, which has already corrupted files here. In JavaScript's `String.replace`, `$$` in a replacement string becomes `$`, which corrupted a migration.
9. **`networkidle` doesn't work in these tests.** Prefetches can stay open. Wait for something specific.
10. **Don't choose a file in tests straight after loading a page.** The change is ignored until React hydrates.
11. **`NEXT_PUBLIC_*` values are fixed at build time.** Rebuild after changing them, including before E2E runs. Image hosts in `next.config.ts` are too.
12. **Use `127.0.0.1`, not `localhost`,** so the origin matches `NEXT_PUBLIC_APP_URL` and cookies line up.
13. **Supabase default privileges grant `anon` and `authenticated` access to new functions and tables.** Every new object needs an explicit `revoke`, and `tests/db/harness.ts` reproduces those defaults so a test can catch a miss.
14. **New top-level route?** Reserve its name in `src/features/usernames/reserved.ts` and in a new migration. A test fails otherwise.
15. **Migrations:** `20261104000000_page_content.sql` was edited during development, before any hosted database existed. From the first `db push` on, never edit an applied migration; write a new one.
16. **Changing the Privacy or Terms version** makes every user accept again. That's intended.

## Decisions taken without asking

The user may want to revisit these:

- Commits and branch layout: Phase 1 as the first commit on `main`, Phases 2–3 on a branch.
- Merged `links` and `content_blocks` into `blocks`. Theme presets stay in code until Phase 6.
- Basic lead storage and the Audience page moved up from Phase 6, because forms have to save somewhere to be real.
- Everything is free for now, and the Pricing page shows no prices and says paid plans aren't on sale.
- Renames: one a day, with old names held for 30 days.
- Limits: 200 blocks per page, 5 MB per image, 40 uploads an hour.
- `react-icons` for brand icons, `@dnd-kit` for drag and drop, and `qrcode` for QR codes.
- Blocked-username list in `reserved.ts`. Privacy and Terms text, written by Claude and **not legally reviewed**.

## Open questions for the user

See PRD.md section 8. Whether `findme.com` is obtainable and a trademark check on the name are the most pressing.

## Next step: Phase 4

Event collection, click tracking through `/l/{blockId}`, daily aggregates, dashboard charts. Basic admin authorisation is also due here for the MVP's Definition of Done. Known gaps to fix along the way are listed in SECURITY.md, and the unchecked or partial items in PROJECT_PLAN.md.
