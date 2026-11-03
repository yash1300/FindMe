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

- [ ] Marketing site: Home, Features, Pricing, Themes, About, Contact, FAQ
- [ ] Final Privacy and Terms text (needs legal review)
- [ ] Full onboarding wizard
- [ ] Dashboard shell, overview and mobile navigation
- [ ] Rename username
- [ ] Close the gap where suspended accounts can still write through the API (SECURITY.md)
- [ ] `blocks`, `social_links`, `theme_presets` migrations
- [ ] Storage buckets and upload validation
- [ ] Link manager: add, edit, delete, duplicate, enable or disable, drag-and-drop with rollback
- [ ] URL validation and dangerous-scheme blocking
- [ ] Social links: 20 platforms, reorder, visibility
- [ ] Public profile engine with SEO metadata
- [ ] Core themes
- [ ] Publish, unpublish, and draft states
- [ ] Sitemap and robots
- [ ] Transactional email through Resend

## Phase 3 — Creator experience

- [ ] Visual editor: settings panel and live preview
- [ ] Undo, redo, autosave, reset, save indicators
- [ ] Concurrent-edit protection
- [ ] All 18 block types, with embed-provider allow-list
- [ ] All 10 themes and full customisation
- [ ] Link scheduling and expiry
- [ ] QR codes: PNG, SVG, colours, logo
- [ ] Sharing: WhatsApp, Facebook, X, LinkedIn, email, native

## Phase 4 — Analytics

- [ ] Event collection with bot filtering and duplicate control
- [ ] Click redirect through stored URLs
- [ ] Daily aggregates and retention job
- [ ] Dashboard metrics, charts and date ranges
- [ ] Privacy notice and controls

**MVP Definition of Done** is met at this point, once critical tests and the production build pass and admin authorisation is in place. Basic admin authorisation is delivered with Phase 4 for this reason, ahead of the full panel in Phase 6.

## Phase 5 — India monetisation

Needs: plan prices, legal entity and GSTIN, Razorpay sandbox keys.

- [ ] `subscription_plans`, `subscriptions`, `payment_events`, `invoices`, `tax_rules`
- [ ] `PaymentProvider` interface and Razorpay implementation
- [ ] Checkout, verified idempotent webhooks
- [ ] Upgrade, downgrade, cancel, renew, failed-payment handling
- [ ] Refund tracking, invoices, GST-aware documents
- [ ] Server-side entitlement enforcement
- [ ] Sandbox verification — required before advertising paid features

## Phase 6 — Business features

- [ ] Multiple profiles
- [ ] Custom domains: Vercel API, DNS verification
- [ ] Leads: newsletter, contact forms, CSV export, deletion
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
