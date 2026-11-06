# FindMe — Project Plan and Progress

**Legend:** `[x]` implemented *and* verified by a test or a run · `[~]` implemented, verification blocked or incomplete (reason given) · `[ ]` not started.

A feature is only `[x]` once its implementation and tests have been verified.

## Phase 1 — Foundation

- [x] Repository inspection (empty apart from `CLAUDE.md`)
- [x] PRD and technical documents
- [x] Project scaffold: Next.js, TypeScript, Tailwind, shadcn/ui
- [x] Brand tokens
- [x] Validated environment configuration
- [x] Security headers
- [x] Structured logging
- [x] Foundation database migration with RLS
- [x] Database and RLS tests (PGlite, plus direct attacks on real PostgREST)
- [x] Registration with username, and consent
- [x] Login and logout
- [x] Email verification
- [x] Password recovery
- [~] Google OAuth: written, never run. Needs Google credentials
- [x] Protected routes
- [x] Username claim for accounts without a profile
- [x] Account management: name, email, password. Export and deletion are in Phase 6
- [x] Rate limiting
- [x] Lint, type check, unit tests, production build
- [x] End-to-end auth tests against a real local Supabase stack
- [ ] Hosted Supabase and Vercel environments. Needs accounts

"Verified" above means against the local stack. Nothing has been tested on a hosted environment.

## Phase 2 — MVP

- [x] Marketing site: Home, Features, Pricing, Themes, About, Contact, FAQ
- [~] Privacy and Terms text: updated, but still drafts. Needs a lawyer
- [x] Full onboarding wizard
- [x] Dashboard shell, overview and mobile navigation. Analytics, Integrations and Billing join in their phases
- [x] Rename username, with a 30-day hold on old names
- [x] Suspended accounts can no longer write through the API
- [x] `blocks`, `social_links`, `leads`, `contact_submissions`, `username_history` migrations
- [x] Storage bucket and upload validation
- [x] Link manager: add, edit, delete, duplicate, enable or disable, drag-and-drop with rollback
- [x] URL validation and dangerous-scheme blocking
- [~] Social links: 20 platforms, adding and link checks verified. Reordering and hiding use the same tested components, but have no browser test of their own
- [x] Public profile engine with SEO metadata and real 404s
- [x] Core themes
- [x] Publish, unpublish, and draft states
- [~] Sitemap and robots: served and checked, but a published profile appearing in the sitemap has no test yet
- [~] Transactional email through Resend: written, never run. Needs a Resend key

## Phase 3 — Creator experience

- [x] Visual editor: settings panel and live preview at phone and desktop sizes
- [ ] Contextual controls: clicking an element in the preview to edit it. Not built; every setting is in the side panel
- [x] Undo, redo, autosave, reset, save indicators
- [x] Concurrent-edit protection
- [x] All 18 block types, with embed-provider allow-list. Real third-party players weren't loaded in tests, only their URLs checked
- [x] All 10 themes and full customisation. Each setting's effect on the page is checked for a sample, not exhaustively
- [x] Link scheduling and expiry
- [x] QR codes: PNG, SVG, colours, logo. Scanning verified by decoding generated codes without a logo graphic on top; test a printed code with a phone
- [~] Sharing: WhatsApp, Facebook, X, LinkedIn and email links verified. The native share button needs a real phone to test

**Added beyond the plan:** newsletter and contact forms needed somewhere to store and read submissions to be real features, so basic lead storage and the Audience page arrived here instead of Phase 6. Its CSV export and custom fields are still Phase 6.

## Phase 4 — Analytics

Verified against the local stack. Not yet on the hosted database or live site.

- [x] Event collection with bot filtering, duplicate control, and Global Privacy Control and Do Not Track
- [x] Click redirect through stored URLs (`/l/{id}`)
- [x] Daily totals, updated as events arrive, and 30-day deletion of raw events
- [x] Dashboard metrics, chart, top links, breakdowns and date ranges
- [x] Privacy notice, and a creator switch to turn analytics off
- [x] Basic admin access: `/admin` figures, shown only to users with an admin role
- [~] Country breakdown: uses Vercel's location header, so it needs checking once deployed
- [ ] Recent activity list on the overview

**Removed from the plan:** the Pricing page and Billing navigation, because FindMe is free for everyone.

**MVP Definition of Done** is met once these browser tests pass, the critical suite runs clean, and the live site is verified.

## Phase 5 — Monetisation (not being built)

**Decision (2026-11-04): FindMe is free for everyone for now.** There's no checkout, billing, plans or entitlements, and all features are available to all users. The checks paid plans must pass are kept as to-do tests in `tests/unit/payments.todo.test.ts`.

If this changes, it needs: plan prices, a legal entity and GSTIN, Razorpay test keys, and a decision on what happens to existing users' features.

## Phase 6 — Business features

Verified against the local stack. Not yet on the hosted database or live site. Everything is available to all users, since FindMe is free.

- [x] Multiple pages: create, switch, edit and delete, each with its own content and analytics. Limit set in admin settings, default 5
- [~] Custom domains: entry, DNS instructions, ownership check, status, removal and routing are tested. Real DNS, the Vercel API and HTTPS have never run, because they need `VERCEL_API_TOKEN` and a real domain
- [x] Leads: custom questions, CSV export with formula protection, deletion
- [x] Admin panel: overview, user search and detail, suspend and restore
- [x] Moderation: public reports for a page or link, suspend page, hide link, resolve or dismiss, with history
- [x] Admin actions and their audit entries save atomically
- [x] Platform settings: page limit and announcement
- [x] Support messages from the Contact page, in admin
- [x] Account data export and self-service deletion
- [~] Maintenance job: refuses without the secret, which is tested. The cleanup itself hasn't run, and it needs `CRON_SECRET`
- [ ] Clean up replaced and unused images in storage
- [ ] Admin editing of theme presets. Presets stay in code, as nothing needs this yet
- [ ] In-app notifications. Not built, as nothing needs them yet

## Phase 7 — Differentiation

Built without new costs or new data collection. Nothing paid, as FindMe is free.

- [ ] AI profile builder: **skipped for now** by the owner's decision (2026-11-06), because of per-use cost and sending creators' text to an AI provider
- [x] Theme gallery: creators share their saved theme by name, others use it; no creator identity or photos shared; 10 per creator; staff can remove, logged
- [x] Advanced analytics: comparison with the previous period, per-link click share, links nobody clicked, busiest weekdays, CSV download
- [x] Creator recommendations: rule-based suggestions on the Overview, from the page's own content and numbers
- [ ] Additional integrations: a UPI payment block was started and removed at the owner's request, since payments are out of scope. No other integration yet

## Phase 8 — Production

- [ ] Security audit, including CSP review
- [ ] Performance testing and Core Web Vitals monitoring
- [ ] Accessibility testing
- [ ] Error monitoring (vendor choice needs approval)
- [ ] Production deployment, verified with the DEPLOYMENT.md checklist
- [ ] Final documentation

## Change log

| Date | Change |
| --- | --- |
| 2026-11-03 | Plan created; Phase 1 implemented and verified locally |
| 2026-11-06 | Phase 7 (without AI or payments) verified locally. Logout moved to its own route; Social icons block now fully controls the icons |
| 2026-11-04 | Phases 4 and 6 verified locally. Dark mode and softer palette added. Hosted migrations and live checks pending |
| 2026-11-04 | Phase 4 written, browser tests pending. Pricing removed; Phase 5 not being built, as FindMe is free |
| 2026-11-04 | Phases 2 and 3 implemented and verified locally. Theme presets stay in code until the Phase 6 admin panel needs to edit them |
