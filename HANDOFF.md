# FindMe — Handoff

Read this first, then [CLAUDE.md](CLAUDE.md) (the spec) and [PROJECT_PLAN.md](PROJECT_PLAN.md) (the checklist).

**Last updated:** 2026-11-04. **Current position:** Phases 1–3 are merged to `main`. Phases 4 and 6 are verified locally on the `phase-6` branch, which includes `phase-4`. Phase 5 isn't being built, because FindMe is free. See [report.md](report.md), and keep it updated after each phase, as the user asked.

## State of the project

- **Code:** on GitHub at <https://github.com/yash1300/FindMe>. `phase-6` must not be merged before step 1 below.
- **Live site:** <https://findme-dun.vercel.app>. At the last check it couldn't reach the database: `/api/health` returned 503 and the sitemap used `localhost:3000`, even after the user updated Vercel. It hasn't been rebuilt with the values, or they aren't set for Production. Routing, 404s and headers work, and no secrets were found in the 13 client code files checked.
- **Hosted Supabase:** project `bzlelfxdazucsoofngce`, with migrations through `20261104000000` applied and audited. **`20261105000000_analytics` and `20261106000000_business` aren't applied.** The agent's attempt was blocked by the permission system as a production deploy, so it needs the user's explicit approval, or the user can run it.
- **Written but never run:** Google sign-in on the live site, Resend email, the Vercel domains API, and the maintenance job's cleanup.

## To go live, in this order

1. `npx supabase db push --remote`, by the user or with their explicit approval.
2. The user checks the Vercel variables are set for Production.
3. Merge `phase-6`, which triggers a rebuild.
4. Re-test the live site, and re-run the hosted audit on the new tables. The scripts were session-only, so recreate them from SECURITY.md's description: temporary users made through the admin API, attacks with real sessions, cleanup, then read-only catalogue queries with `supabase db query --remote --read-only`.

## Running it

Docker Desktop must be running. It's installed at `%LOCALAPPDATA%\Programs\DockerDesktop\`, not the usual path.

```bash
npx supabase start      # the local stack, with images already downloaded on this machine
npm run dev             # http://127.0.0.1:3000; emails appear at http://127.0.0.1:54324
```

`.env.local` is gitignored, and now holds the **hosted** project's values, with `NEXT_PUBLIC_APP_URL` set to the live site, at the user's request. So local sign-in emails and redirects lead to the live site. For tests, don't edit it: pass local values through the process environment, which take priority over `.env` files. Set `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000`, plus `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from `npx supabase status -o env`, for both the build and the tests. The tests refuse to run against anything but a local database.

**The current `.next` build points at the local stack.** `npm run dev` is unaffected, but rebuild before using `npm start`.

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
9. **Client navigation keeps the previous page mounted but hidden,** so test selectors can match it. Filter with `{ visible: true }`.
10. **`networkidle` doesn't work in these tests.** Prefetches can stay open. Wait for something specific.
10. **Don't choose a file in tests straight after loading a page.** The change is ignored until React hydrates.
11. **`NEXT_PUBLIC_*` values are fixed at build time.** Rebuild after changing them, including before E2E runs. Image hosts in `next.config.ts` are too.
12. **Use `127.0.0.1`, not `localhost`,** so the origin matches `NEXT_PUBLIC_APP_URL` and cookies line up.
13. **Supabase default privileges grant `anon` and `authenticated` access to new functions and tables.** Every new object needs an explicit `revoke`, and `tests/db/harness.ts` reproduces those defaults so a test can catch a miss.
14. **New top-level route?** Reserve its name in `src/features/usernames/reserved.ts` and in a new migration. A test fails otherwise.
15. **Migrations:** `20261104000000_page_content.sql` was edited during development, before any hosted database existed. From the first `db push` on, never edit an applied migration; write a new one.
16. **Changing the Privacy or Terms version** makes every user accept again. That's intended.

## Decisions taken without asking

The user may want to revisit these:

- "Keep the test cases" for payments was read as: don't build payments, and keep the checks as to-do tests. Please correct this if something else was meant.
- Phase 4 adds a creator switch to turn analytics off, and respects Global Privacy Control and Do Not Track.
- A creator's own visits to their public page count as views.
- Admins are granted through SQL, with no screen for it.
- Every Phase 6 feature is available to all users, with a limit of 5 pages per account, changeable in admin settings.
- Accounts never confirmed after 30 days are deleted by the daily job.
- A softer palette replaced the suggested Midnight primary with a deep violet, as the user invited palette changes.
- Commits and branch layout: Phase 1 as the first commit on `main`, later phases on branches.
- Merged `links` and `content_blocks` into `blocks`. Theme presets stay in code until Phase 6.
- Basic lead storage and the Audience page moved up from Phase 6, because forms have to save somewhere to be real.
- Renames: one a day, with old names held for 30 days.
- Limits: 200 blocks per page, 5 MB per image, 40 uploads an hour.
- `react-icons` for brand icons, `@dnd-kit` for drag and drop, and `qrcode` for QR codes.
- Blocked-username list in `reserved.ts`. Privacy and Terms text, written by Claude and **not legally reviewed**.

## Open questions for the user

See PRD.md section 8. Whether `findme.com` is obtainable and a trademark check on the name are the most pressing.

## Next: Phase 7 or 8

Phase 7's items each need the user's decision on cost and privacy. Phase 8 is the audit, performance and accessibility work, and launch. Known gaps are listed in SECURITY.md, and unchecked or partial items in PROJECT_PLAN.md.
