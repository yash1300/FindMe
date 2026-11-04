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

Written and covered by unit and database tests. **Browser tests are written but haven't been run, because the machine ran out of memory, so these stay `[~]` until they pass.**

- [~] Event collection with bot filtering, duplicate control, and Global Privacy Control and Do Not Track
- [~] Click redirect through stored URLs (`/l/{id}`)
- [~] Daily totals, updated as events arrive, and 30-day deletion of raw events
- [~] Dashboard metrics, chart, top links, breakdowns and date ranges
- [~] Privacy notice, and a creator switch to turn analytics off
- [~] Basic admin access: `/admin` figures, shown only to users with an admin role
- [ ] Country breakdown on Vercel: uses Vercel's location header, so it needs checking once deployed
- [ ] Recent activity list on the overview

**Removed from the plan:** the Pricing page and Billing navigation, because FindMe is free for everyone.

**MVP Definition of Done** is met once these browser tests pass, the critical suite runs clean, and the live site is verified.

## Phase 5 — Monetisation (not being built)

**Decision (2026-11-04): FindMe is free for everyone for now.** There's no checkout, billing, plans or entitlements, and all features are available to all users. The checks paid plans must pass are kept as to-do tests in `tests/unit/payments.todo.test.ts`.

If this changes, it needs: plan prices, a legal entity and GSTIN, Razorpay test keys, and a decision on what happens to existing users' features.

## Phase 6 — Business features

- [ ] Multiple profiles
- [ ] Custom domains: Vercel API, DNS verification
- [ ] Leads: CSV export and custom fields. Forms, consent and deletion shipped in Phase 3
- [ ] Clean up replaced and unused images in storage
- [ ] Admin dashboard, user management, moderation
- [ ] Atomic audit logging for admin actions
- [ ] Account data export and self-service deletion
- [ ] Cleanup of long-unverified accounts

## Phase 7 — Differentiation

Each item needs approval because of cost and privacy impact.

- [ ] AI profile builder
- [ ] Theme marketplace
- [ ] Advanced analytics
- [ ] Creator recommendations
- [ ] Additional integrations

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
| 2026-11-04 | Phase 4 written, browser tests pending. Pricing removed; Phase 5 not being built, as FindMe is free |
| 2026-11-04 | Phases 2 and 3 implemented and verified locally. Theme presets stay in code until the Phase 6 admin panel needs to edit them |
