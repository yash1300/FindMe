# FindMe — Progress Report

A plain summary of where each phase stands. The detailed checklist is in [PROJECT_PLAN.md](PROJECT_PLAN.md), and technical notes for whoever continues the work are in [HANDOFF.md](HANDOFF.md).

**Last updated:** 2026-11-06

## At a glance

| Phase | What it covers | Status |
| --- | --- | --- |
| 1 | Foundation, accounts, sign-in, database security | Done, merged to `main` |
| 2 | Marketing site, dashboard, links, public pages | Done, merged to `main` |
| 3 | Visual editor, content blocks, themes, QR codes | Done, merged to `main` |
| 4 | Analytics and basic admin access | Live and tested |
| 5 | Payments | **Not being built.** FindMe is free for everyone for now |
| 6 | Multiple pages, custom domains, moderation, data export | Live. Custom domains and admin suspend actions not tested live |
| 7 | Theme gallery, advanced analytics, recommendations | Done locally on the `phase-7` branch, not live yet. AI builder skipped and payment features out of scope, by your decision |
| 8 | Security audit, performance and accessibility testing, launch | Not started |

## Live site status

**The live site works, but new people can't reliably sign up until a custom email sender is set up.** On 2026-11-05, hosted Supabase refused a sign-up to an outside address with `over_email_send_rate_limit`. Its built-in sender has a very low limit, and is meant for testing rather than the public. Password reset emails depend on the same sender. See Step 4 of [ENV_SETUP.md](ENV_SETUP.md).

### Still to check by hand

1. Set up the email sender, then sign up with a different real address and open the confirmation link.
2. Test Forgot password from its email.
3. Check Vercel's Logs tab to see that the daily cleanup job ran.

### On the `phase-7` branch, not live until merged

**You need to update the hosted database first**, with `npx supabase db push --linked`, then merge. The two new migrations add the Social icons rule and the theme gallery.

Fixes from your second review:

- **Logging out:** it now has its own route, which always deletes the sign-in cookies, even if Supabase can't be reached. Before, logging out shared a response with the automatic session renewal, so in some cases the browser could keep a fresh session cookie. Google's account chooser was already being requested on the live site, which I checked. FindMe can't sign you out of Google itself, so Google will still list your account to pick.
- **Social icons:** they now appear only where the Social icons block is. Hiding or deleting the block takes them off the page. Every page gets the block at the top, where icons appeared before. Pages can't have two, and My Page offers "Show icons on my page" when they're off.
- **Smaller fixes:** a cancelled Google sign-in now says so, instead of "That link is invalid". Adding the same social link twice at once gives a clear message. An empty icons spot no longer leaves a gap.

Phase 7, all free, with no new data collected:

- **Theme gallery** on the Appearance page. Creators share their saved theme by name, and others use it in one click. The creator's name, page and photos are never shared. Each person can share up to 10, and staff can remove any at Admin → Shared themes, which is logged.
- **Advanced analytics:** each figure is compared with the previous period, and top links show their share of views. There's a list of links nobody clicked, busiest weekdays over 2 weeks or more, and a CSV download.
- **Suggestions** on the Overview, worked out from simple rules about the page and its numbers. For example: publish, add a photo or bio, move a popular link that sits low on the page, or turn social icons back on. Nothing is sent to an AI service.

Not built: the AI profile builder (skipped by you), and a UPI payment block, removed at your request because payments are out of scope.

Found but not fixed: in a local test with sign-in tokens set to expire after 30 seconds, very large sign-in cookies were signed out on refresh. Normal-size sessions, including Google's, weren't affected. Details are in SECURITY.md.

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

Latest results are for the `phase-7` branch, run against a local copy of the database, in smaller groups because of limited memory.

| Check | Result |
| --- | --- |
| Lint and type check | Pass |
| Unit and database tests | 667 passed, plus 15 payment to-dos |
| Browser: this round (logout, social icons, suggestions, analytics download, theme gallery), sign-in, accounts and security attacks | 43 of 43 |
| Browser: page builder and marketing | 26 of 26 |
| Browser: analytics, admin, Phase 6 and dark mode | 23 of 23 |
| Every page on phone and desktop, in light and dark, plus all 10 themes (130 page views, previous round) | No sideways scrolling or browser errors. The 48 serious readability failures, all on public page styles, were fixed, and all 10 themes re-checked clean |

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
