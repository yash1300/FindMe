# FindMe — Product Requirements Document

> **Your entire world. One link.**
> The full specification lives in [CLAUDE.md](CLAUDE.md). This PRD distils it into what we are building, for whom, how we will judge it, and what is still undecided.

## 1. Problem

Creators, freelancers and small businesses are spread over many platforms, but most of those platforms allow one bio link. FindMe gives them a single page for everything, built first for Indian customers: INR pricing, UPI through Razorpay, and GST-aware invoices. Competitor pricing and features have not been researched yet, so this document makes no claims about them.

## 2. Product

A page at `{canonical-domain}/username` that holds a person's whole online presence, plus the tooling to build it, measure it and earn from it.

| Area | Audience | Character |
| --- | --- | --- |
| Marketing site | Prospective users | Polished, SEO-friendly, honest — no invented stats or testimonials |
| Creator dashboard | Signed-in creators | Premium, minimalist, light surfaces with dark navigation |
| Public profile engine | Everyone on the internet | Expressive, themeable, and fast |
| Admin panel | FindMe staff | Separate, server-authorised, fully audited |

## 3. Target users

- **Creators and influencers** — a beautiful page, analytics, and mobile-first editing.
- **Freelancers and artists** — portfolio, services, contact form.
- **Small businesses** — custom domain, lead collection, several profiles.
- **Launch market: India.** INR, Asia/Kolkata, en-IN, Razorpay with UPI, GST-aware billing. All of these are configuration rather than hardcoding, so other markets can follow.

## 4. Differentiators

These are how FindMe avoids being "just another Linktree clone". They are goals, not current claims.

1. **India-native billing** — INR pricing, UPI through Razorpay, proper GST-aware invoices.
2. **Visual identity at every tier** — a real theme engine, not a colour picker.
3. **Privacy-respecting analytics** — no raw IP storage; visitor counts are labelled as estimates.
4. **Speed** — public pages are rendered and cached separately from the dashboard.

## 5. Scope

### MVP (Phases 1–4, per the spec's Definition of Done)

Marketing site, authentication, onboarding, username management, dashboard, link management, content blocks, themes, publishing, public profiles, QR codes, core analytics, database security, admin authorisation, responsive layouts, critical tests, a production build, and deployment documentation.

### Post-MVP

- **Phase 5:** Razorpay subscriptions, webhooks, invoices, entitlements.
- **Phase 6:** Multiple profiles, custom domains, leads, full admin and moderation.
- **Phase 7:** AI builder, theme marketplace, recommendations. Each of these needs separate approval because of its cost and privacy impact.
- **Phase 8:** Security audit, performance and accessibility testing, production launch.

### Non-goals for the MVP

Native apps, multiple languages, Stripe or other currencies (the architecture allows for them; they are not built), team accounts, and selling products directly from a page.

## 6. Plans

From Phase 5, prices, limits and entitlements will live in the database and be editable by admins. Until then, everything built so far is free for all users, with FindMe branding on every page. **No prices are decided yet — see [Open decisions](#8-open-decisions).**

| | Free | Pro | Business |
| --- | --- | --- | --- |
| Profiles | 1 | 1 | Multiple |
| Links and core blocks | Yes | Yes | Yes |
| Themes | Basic | Advanced | Advanced |
| Analytics | Basic | Advanced | Advanced |
| Scheduling and extra blocks | — | Yes | Yes |
| Remove FindMe branding | — | Yes | Yes |
| Custom domains, lead collection | — | — | Yes |
| Priority support | — | — | Yes |

## 7. Success measures

These are targets to instrument and check, not achievements.

| Measure | Target |
| --- | --- |
| Sign-up to published page | Under 5 minutes |
| Public page LCP (p75, mobile) | Under 2.5 s |
| Public page cost as blocks grow | Payload grows linearly; no client JS for static blocks |
| Accessibility | WCAG 2.2 AA on core flows |
| Cross-tenant data access | Zero — enforced by RLS and covered by automated tests |

Product KPIs once live: activation rate (registered to published), weekly active creators, free-to-paid conversion, and churn.

## 8. Open decisions

Owner: product owner. "Blocks" means the listed phase cannot be finished without an answer. Everything else has a working default.

| # | Decision | Default until decided | Blocks |
| --- | --- | --- | --- |
| 1 | **Domain.** Is `findme.com` actually owned or purchasable? | The domain comes from `NEXT_PUBLIC_APP_URL`; nothing is hardcoded | Phase 8 |
| 2 | **Trademark.** "FindMe" is a generic and likely contested name. Run a search before spending on brand | Continue building | Phase 8 |
| 3 | **Plan prices** in INR, monthly and annual | No prices are displayed; the Pricing page shows features only | Phase 5 |
| 4 | **Legal entity and GSTIN** for Razorpay and invoices | Billing stays disabled | Phase 5 |
| 5 | **Legal text.** Lawyer review of Privacy and Terms, including DPDP Act obligations | Pages are clearly marked as drafts | Phase 8 |
| 6 | **Support and grievance contact** details | Read from environment configuration | Phase 8 |
| 7 | **Analytics retention period** | 90 days raw, aggregates kept | Phase 4 |
| 8 | **AI provider, budget and data handling** | Not built | Phase 7 |
