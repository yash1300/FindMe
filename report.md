# FindMe — Progress Report

A plain summary of where each phase stands. The detailed checklist is in [PROJECT_PLAN.md](PROJECT_PLAN.md), and technical notes for whoever continues the work are in [HANDOFF.md](HANDOFF.md).

**Last updated:** 2026-11-04

## At a glance

| Phase | What it covers | Status |
| --- | --- | --- |
| 1 | Foundation, accounts, sign-in, database security | Done, merged to `main` |
| 2 | Marketing site, dashboard, links, public pages | Done, merged to `main` |
| 3 | Visual editor, content blocks, themes, QR codes | Done, merged to `main` |
| 4 | Analytics and basic admin access | Live and tested |
| 5 | Payments | **Not being built.** FindMe is free for everyone for now |
| 6 | Multiple pages, custom domains, moderation, data export | Live. Custom domains and admin suspend actions not tested live |
| 7 | AI builder, theme marketplace, recommendations | Not started. Each needs a decision on cost and privacy |
| 8 | Security audit, performance and accessibility testing, launch | Not started |

## Live site status

**The live site is working, but real sign-up emails are still unproven.** Tested on 2026-11-04 with temporary accounts, since removed.

### Still to check by hand

1. Sign up with a different real email address, and open the confirmation link. Supabase's built-in email sender may only deliver to the project's own team members, which would block the public from signing up.
2. Finish a real Google sign-in. The button now reaches Google's sign-in page.
3. After 22:00 UTC, check Vercel's Logs tab to see that the cleanup job ran.

### Fixes on the `phase-6-fixes` branch, not live until merged

- **Speed:** the site's server ran in the US (`iad1`) and the database is in Tokyo, so `vercel.json` now moves the server to Tokyo (`hnd1`). The health check took about a second from India before this change. The improvement hasn't been measured yet.
- **Sign-up message:** an address Supabase rejects now asks for a different email, instead of showing "We can't process that right now".

### Unexplained

Connections to the site occasionally dropped during testing (`ECONNRESET`, `ERR_CONNECTION_RESET`), and some requests took over 30 seconds. A separate test of 75 requests, 25 each to the live site's health check, a static file and Supabase, had no failures. The cause is unknown, and it could be the test machine's network.

## Phase details

### Phase 4: analytics and admin access

Page views and link clicks are counted, with a dashboard showing estimated visitors, click-through rate, a trend chart, top links, and breakdowns by traffic source, device, browser, system and country.

Privacy, as you decided: **raw events are deleted after 30 days, and only daily totals are kept.** IP addresses aren't stored. Visitors are counted using a scrambled ID that changes daily and differs per page. Bots, previews, and browsers asking not to be tracked aren't counted, and creators can turn analytics off.

Still to check once live: the country breakdown, which relies on a header Vercel adds.

### Phase 5: payments

Not built, because FindMe is free for everyone. The Pricing page and billing links are gone. The checks paid plans must pass are kept as to-do tests in `tests/unit/payments.todo.test.ts`.

### Phase 6: business features

| Feature | Notes |
| --- | --- |
| **Multiple pages** | Each has its own link, content, look and analytics. Limit of 5 per account, which admins can change |
| **Custom domains** | Add a domain, prove ownership with a DNS record, and it serves the page. **Not proven end to end:** see below |
| **Leads** | Custom questions on contact forms, and CSV export protected against spreadsheet formula attacks |
| **Your data** | Download everything, or permanently delete your account, in Settings |
| **Reporting** | A Report link on every public page, for the whole page or one link |
| **Admin panel** | Overview, user search, suspend and restore, reports, messages, audit log and settings |
| **Audit trail** | Each admin action and its log entry save together or not at all, and the log can't be edited |
| **Maintenance job** | Daily cleanup of old analytics and accounts never confirmed after 30 days. Needs `CRON_SECRET` set in Vercel |

**Custom domains need setup you haven't done yet.** Connecting a domain to Vercel needs `VERCEL_API_TOKEN` and `VERCEL_PROJECT_ID`. Without them, customers can prove ownership, but the domain doesn't go live, and the app says so. Check the domain limits on your Vercel plan too. Tests covered everything except a real domain with real DNS and HTTPS.

### Design updates

- **Dark mode:** a button in every header. It follows your device's setting until you choose, and remembers your choice. Creators' public pages keep their own themes.
- **Softer colours:** both modes avoid pure white and pure black, which reduces glare. A test checks readability, so a later change can't quietly break it.
- **Phone card on the landing page:** panels now keep even margins instead of touching the edges, and content fits or scrolls rather than being cut off. This also improves real pages on phones.

## Test results

Run against a local copy of the database, in smaller groups because of limited memory.

| Check | Result |
| --- | --- |
| Lint and type check | Pass |
| Unit and database tests | 601 passed, plus 15 payment to-dos |
| Browser: sign-in and accounts | 24 of 24 |
| Browser: security attacks | 8 of 8 |
| Browser: analytics and admin access | 7 of 7, on the Phase 4 code |
| Browser: page builder and marketing | 26 of 26 |
| Browser: Phase 6 and dark mode | 16 of 16 |

All 81 browser tests have passed, but not in one single run, and the analytics group wasn't re-run after the Phase 6 changes. Please run the full suite once on a machine with more free memory.

**Live site walkthrough (2026-11-04):** 31 checks covering pages, onboarding, the page builder, analytics, leads, multiple pages, domain setup, reports, admin screens, data export and account deletion. All passed, though not in one run: account deletion passed in the previous run and was left out of the last one, and the admin screens passed in a separate run. The walkthrough left one permanent `account.deleted` audit entry, which shows only an ID.

**Security audit of the live database:** 83 of 83 checks passed on 2026-11-04, including the Phase 4 and Phase 6 tables. Temporary test accounts were removed afterwards. This tested the database directly, not the live website.

## Before a public launch

- Lawyer review of the Privacy Policy and Terms. Both are still marked as drafts
- Whether `findme.com` is obtainable, and a trademark check on the name
- Removing location data from uploaded photos
- Error monitoring, and performance and accessibility testing (Phase 8)
- Resend setup, if you want notification emails
- Custom email sending for sign-ups, if Supabase's built-in sender blocks outside addresses or its low hourly limit gets in the way
- Testing a custom domain with real DNS and HTTPS

Known gaps are listed in [SECURITY.md](SECURITY.md).
