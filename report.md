# FindMe — Progress Report

A plain summary of where each phase stands. The detailed checklist is in [PROJECT_PLAN.md](PROJECT_PLAN.md), and technical notes for whoever continues the work are in [HANDOFF.md](HANDOFF.md).

**Last updated:** 2026-11-05

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

**The live site works, but new people can't reliably sign up until a custom email sender is set up.** On 2026-11-05, hosted Supabase refused a sign-up to an outside address with `over_email_send_rate_limit`. Its built-in sender has a very low limit, and is meant for testing rather than the public. Password reset emails depend on the same sender. See Step 4 of [ENV_SETUP.md](ENV_SETUP.md).

### Still to check by hand

1. Set up the email sender, then sign up with a different real address and open the confirmation link.
2. Test Forgot password from its email.
3. Check Vercel's Logs tab to see that the daily cleanup job ran.

### Fixes on the `improvements` branch, not live until merged

- **Google sign-in:** Google now always asks which account to use, so logging out no longer leads to a silent sign-in.
- **Sign-up screens:** the confirmation screen explains spam folders and what happens with an address that already has an account, and the form says when the email limit has been reached. A failed login also points people who signed up with Google to the right button.
- **Social links:** each one now also adds a full button that can be edited, and "Add buttons for my links" covers links added earlier. Hiding or removing a link does the same to its button.
- **Landing page:** it now says clearly that FindMe is free for everyone, in the hero, its own section, the closing section and the footer.
- **Unreadable themes:** Glass had blank form buttons, and Gradient had white text on white cards. Colours are now checked as the page is drawn, which also repairs pages already saved.
- **Dropped connections:** saves that lose their connection now show a message instead of stalling silently.
- **Photo privacy:** location and other hidden data is removed from uploads, keeping the photo's rotation. Images uploaded earlier aren't changed.

Moving the server to Tokyo is already live: the health check took 0.27 to 0.95 seconds in five checks, compared with about a second before.

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

Latest results are for the `improvements` branch, run against a local copy of the database, in smaller groups because of limited memory.

| Check | Result |
| --- | --- |
| Lint and type check | Pass |
| Unit and database tests | 645 passed, plus 15 payment to-dos |
| Browser: sign-in, accounts, security attacks and this round's fixes | 37 of 37 |
| Browser: page builder and marketing | 26 of 26 |
| Browser: analytics, admin, Phase 6 and dark mode | 23 of 23 |
| Every page on phone and desktop, in light and dark, plus all 10 themes (130 page views) | No sideways scrolling or browser errors. The 48 serious readability failures, all on public page styles, were fixed, and all 10 themes re-checked clean |

The dashboard, marketing and admin screens had no serious accessibility failures of their own, in an automated check. That doesn't replace testing with real assistive technology, which is still part of Phase 8.

**Live site walkthrough (2026-11-04):** 31 checks covering pages, onboarding, the page builder, analytics, leads, multiple pages, domain setup, reports, admin screens, data export and account deletion. All passed, though not in one run: account deletion passed in the previous run and was left out of the last one, and the admin screens passed in a separate run. The walkthrough left one permanent `account.deleted` audit entry, which shows only an ID.

**Security audit of the live database:** 83 of 83 checks passed on 2026-11-04, including the Phase 4 and Phase 6 tables. Temporary test accounts were removed afterwards. This tested the database directly, not the live website.

## Before a public launch

- Lawyer review of the Privacy Policy and Terms. Both are still marked as drafts
- Whether `findme.com` is obtainable, and a trademark check on the name
- Error monitoring, and performance and accessibility testing (Phase 8)
- Resend setup, if you want notification emails
- A custom email sender for sign-ups and password resets, ideally from your own domain
- Testing a custom domain with real DNS and HTTPS

Known gaps are listed in [SECURITY.md](SECURITY.md).
