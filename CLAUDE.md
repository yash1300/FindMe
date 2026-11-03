FINDME — OFFICIAL PRODUCT & DEVELOPMENT SPECIFICATION
Premium Link-in-Bio SaaS Platform | India-First | Global-Ready

You are the CTO, principal software architect, senior full-stack engineer, UI/UX designer, database architect, security engineer, QA engineer, and DevOps engineer responsible for building FindMe.

Your mission is to develop FindMe into a premium, production-ready link-in-bio SaaS platform that competes with and aims to outperform established platforms such as Linktree.

This is a real commercial software product.

Do not build a static prototype or a collection of disconnected UI screens.

Build a fully functional application with a frontend, backend, database, authentication, profile editor, public pages, analytics, subscription system, admin panel, and deployment infrastructure.

==================================================

OFFICIAL PRODUCT IDENTITY

Product name: FindMe

Preferred domain: findme.com

Tagline: Your entire world. One link.

Alternative tagline: Everything you are, in one link.

Product category: Link-in-bio platform / Creator SaaS / Personal landing page builder.

Launch strategy: India first, international expansion later.

Brand direction: HYBRID.

This means:

CREATOR DASHBOARD:

Premium minimalist design.
Clean white and light-grey surfaces.
Sophisticated typography.
Dark sidebar or navigation accents.
Elegant cards and charts.
Clear visual hierarchy.
Professional SaaS experience.

PUBLIC PROFILE:

Creative and expressive.
Highly customizable.
Colorful themes.
Gradients.
Beautiful typography.
Personalized layouts.
Premium animations.
Strong visual identity.

The creator dashboard and public profile should feel like two complementary parts of the same brand.

Brand personality:

Premium.
Modern.
Minimal.
Creative.
Professional.
Approachable.
Innovative.

Suggested design palette:

Midnight: #111827
White: #FFFFFF
Electric Violet: #7657F6
Mint: #20C997
Soft Grey: #F3F4F6

Use these as initial design tokens, not limitations on profile customization.

Build an original brand. Do not copy proprietary Linktree designs, source code, or branding.

==================================================

PRODUCT VISION

FindMe allows creators, influencers, freelancers, artists, businesses, and individuals to create one beautiful public page containing their entire online presence.

Every user gets a unique profile URL.

Example: findme.com/username

Users can add:

Social media links.
Websites.
Portfolio links.
YouTube videos.
Music links.
Product links.
Services.
Contact information.
Images.
Videos.
Embedded content.
Newsletter signup.
Contact forms.
Announcements.

The public page becomes their digital home.

The platform has four major application areas:

Marketing website.
Creator dashboard.
Public profile engine.
Secure administration panel.

==================================================

INDIA-FIRST BUSINESS STRATEGY

Build for Indian customers first.

Default settings:

Currency: INR.
Timezone: Asia/Kolkata.
Locale: en-IN.
Date formatting: Indian conventions.
Language: English initially.

Payment gateway:

Razorpay as the initial Indian payment provider.
Stripe as a future international payment integration, subject to availability and eligibility.

Support payment methods available through the configured payment provider, including UPI, cards, and net banking where supported.

Build:

Monthly subscriptions.
Annual subscriptions.
Configurable pricing.
Payment confirmation.
Subscription management.
Cancellation.
Renewal handling.
Failed payment handling.
Refund tracking.
Invoice history.

Build GST-aware billing architecture with configurable tax handling and proper invoice documentation.

Do not hardcode tax assumptions.

Make it possible to support USD and additional currencies in future.

Design privacy and consent management with applicable Indian data-protection requirements in mind.

==================================================

TECHNOLOGY STACK

Use the following preferred architecture:

Frontend:

Next.js App Router.
React.
TypeScript.
Tailwind CSS.
shadcn/ui.
Lucide icons.

Backend:

Next.js server-side APIs.
Server Actions where appropriate.
Modular business logic.
Zod validation.

Database:

Supabase PostgreSQL.

Authentication:

Supabase Auth.
Email/password.
Google OAuth.
Email verification.
Password recovery.

Storage:

Supabase Storage.

Payments:

Razorpay initially.
Provider abstraction for future Stripe integration.

Email:

Resend.

Testing:

Vitest.
React Testing Library.
Playwright.

Hosting:

Vercel.
Supabase.
GitHub.

Monitoring:

Appropriate error monitoring and structured logs.

Use compatible stable package versions.

Do not install unnecessary dependencies.

Keep privileged database operations on the server.

Never expose Supabase service-role keys in client-side code.

Use Supabase Row Level Security for user-owned records.

==================================================

MARKETING WEBSITE

Build a polished public marketing website.

Pages:

Home.
Features.
Pricing.
Themes.
About.
Contact.
FAQ.
Login.
Registration.
Privacy policy.
Terms of service.

Homepage hero:

Headline: "Your entire world. One link."

Description: "Bring your links, content, socials, and brand together in one beautiful place. Create your FindMe page in minutes."

Primary CTA: "Create your free page"

Secondary CTA: "Explore examples"

Homepage sections:

Hero with interactive product preview.
How FindMe works.
Product showcase.
Profile customization.
Creator dashboard preview.
Analytics preview.
Use cases.
Pricing.
FAQ.
Final CTA.
Footer.

Make the site responsive and SEO-friendly.

Do not invent customer testimonials, revenue numbers, user counts, or product statistics.

==================================================

AUTHENTICATION AND ONBOARDING

Implement:

Registration.
Login.
Logout.
Google OAuth.
Email verification.
Password recovery.
Account management.
Secure sessions.
Protected routes.

Registration should collect:

Name.
Email.
Password.
Username.

Username rules:

Unique.
Case-insensitive uniqueness.
URL-safe.
Length validation.
Reserved-name protection.
Prohibited-name protection.

Onboarding workflow:

Welcome.
Select username.
Upload profile picture.
Enter display name.
Write bio.
Select creator category.
Add social links.
Choose theme.
Preview.
Publish.

Make optional steps skippable.

Show progress throughout onboarding.

==================================================

CREATOR DASHBOARD

Build a premium minimalist SaaS dashboard.

Navigation:

Overview.
My Page.
Links.
Appearance.
Analytics.
Audience.
Integrations.
QR Code.
Settings.
Billing.
Help.

Dashboard metrics:

Profile views.
Estimated unique visitors.
Link clicks.
Click-through rate.
Active links.
Recent activity.
Top-performing links.
Performance chart.

Quick actions:

Edit page.
Add link.
Customize.
Preview.
Share.

Include responsive mobile navigation.

Use real database data.

Provide appropriate loading, error, and empty states.

==================================================

LINK MANAGEMENT

Build a complete link manager.

Users can:

Add links.
Edit links.
Delete links.
Duplicate links.
Reorder links.
Enable and disable links.
Schedule links.
Set expiration dates.
Add descriptions.
Upload thumbnails.
Select icons.
Customize buttons.

Implement drag-and-drop reordering.

Save order reliably to the database.

Use optimistic updates carefully, with rollback on failures.

Validate URLs and block dangerous schemes.

Track clicks through a secure redirect or event-recording flow.

Do not introduce open-redirect vulnerabilities.

==================================================

BLOCK-BASED PROFILE BUILDER

Create a modular block architecture.

Supported initial blocks:

Standard link.
Social icons.
Heading.
Text.
Image.
YouTube.
Video embed.
Spotify.
SoundCloud.
Contact information.
Email button.
Phone button.
Divider.
Announcement.
Featured link.
Product card.
Newsletter form.
Contact form.

Users can add, remove, edit, and reorder blocks.

Support block visibility controls where appropriate.

Validate embed providers.

Never render arbitrary untrusted HTML or execute user-supplied scripts.

==================================================

PUBLIC PROFILE ENGINE

Every user gets a public page:

findme.com/username

Profile features:

Avatar.
Cover image.
Display name.
Username.
Bio.
Social links.
Content blocks.
Link buttons.
Footer.
Optional FindMe branding depending on plan.

Build a highly optimized public rendering engine.

Themes:

Minimal.
Modern.
Dark.
Light.
Glass.
Gradient.
Editorial.
Creator.
Business.
Artistic.

Allow customization of:

Background.
Colors.
Gradients.
Typography.
Buttons.
Shapes.
Borders.
Shadows.
Spacing.
Layout.
Icons.
Animations.
Profile picture shape.

Support:

Mobile preview.
Desktop preview.
Live editing preview.

Public pages must remain fast even when users add many blocks.

Support publication states:

Draft.
Published.
Unpublished.
Suspended.

Only authorized users can modify profiles.

==================================================

VISUAL APPEARANCE EDITOR

Build a visual editor.

Desktop:

Left settings panel.
Center live preview.
Contextual component controls.

Mobile:

Responsive editor.
Preview switching.
Accessible controls.

Editor features:

Theme selection.
Background customization.
Typography.
Colors.
Buttons.
Layout.
Effects.
Avatar settings.
Cover settings.
Undo.
Redo.
Save.
Reset.
Autosave.

Implement proper saving indicators and error recovery.

Prevent concurrent editing from silently overwriting changes.

==================================================

SOCIAL INTEGRATIONS

Support social links for:

Instagram, TikTok, YouTube, Facebook, X, LinkedIn, Pinterest, Snapchat, Twitch, Discord, WhatsApp, Telegram, GitHub, Reddit, Spotify, SoundCloud, Apple Music, Threads, Email and Website.

Users can reorder and control visibility.

Validate URLs.

Use recognizable icons.

Do not claim social account verification based only on a submitted URL.

==================================================

ANALYTICS

Implement a real event-driven analytics engine.

Track:

Profile views.
Estimated unique visitors.
Link clicks.
CTR.
Referrer category.
Device category.
Browser category.
Operating system category.
Country-level information where available and permitted.
Top-performing links.
Time-based trends.

Dashboard date ranges:

Today.
7 days.
30 days.
90 days.
Custom.

Build:

Analytics event collection.
Raw event storage.
Daily aggregates.
Bot filtering.
Duplicate-event controls.
Efficient queries.
Date filtering.
Privacy-aware retention.

Do not track internal previews as public traffic.

Do not promise perfect visitor identification.

Use clear privacy notices.

==================================================

QR CODE AND SHARING

Every profile should have a QR code.

Support:

PNG downloads.
SVG downloads.
Color customization.
Logo inclusion.
QR preview.
Copy profile URL.

Sharing:

WhatsApp.
Facebook.
X.
LinkedIn.
Email.
Native share API where supported.

Generate dynamic social sharing metadata.

==================================================

SUBSCRIPTIONS AND MONETIZATION

Implement configurable subscription plans.

Suggested plans:

FREE:

One profile.
Core links.
Basic themes.
Basic customization.
Basic analytics.
FindMe branding.

PRO:

Advanced themes.
Advanced analytics.
Scheduling.
More customization.
Additional content blocks.
Remove FindMe branding.

BUSINESS:

Custom domains.
Multiple profiles.
Advanced analytics.
Lead collection.
Business tools.
Priority support.

All prices, limits, and entitlements must be configurable.

Build server-side entitlement enforcement.

Do not rely on frontend plan checks alone.

Implement Razorpay checkout and verified webhooks.

Make webhook processing idempotent.

Do not grant subscription access based solely on frontend success callbacks.

Support cancellation, renewal, failed payments, upgrades, downgrades, and payment history.

Never store card details.

==================================================

CUSTOM DOMAINS

Support custom domain connections for eligible plans.

Features:

Domain entry.
DNS instructions.
Ownership verification.
Domain mapping.
HTTPS.
Removal.
Status tracking.

Build domain resolution without hardcoding findme.com throughout the application.

The initial deployment should support an environment-configured canonical domain.

Allow development and staging domains.

==================================================

MULTIPLE PROFILES AND LEADS

Support multiple profiles for eligible plans.

Allow users to:

Create profiles.
Switch profiles.
Edit profiles.
Manage independent links.
View individual analytics.

Lead features:

Newsletter signup.
Contact forms.
Custom fields.
Consent tracking.
CSV export.
Lead management.
Data deletion.

Protect all lead information with strict authorization.

==================================================

ADMIN DASHBOARD

Create a separate secure administration dashboard.

Dashboard:

Registered users.
Active users.
Published profiles.
Views.
Clicks.
Active subscriptions.
Revenue metrics.

User management:

Search.
View.
Suspend.
Restore.
Review reports.

Moderation:

Reported profiles.
Reported links.
Moderation decisions.
Action history.

Configuration:

Plans.
Pricing.
Feature limits.
Theme presets.
Announcements.
Support.

Every sensitive administrative action must be logged.

Use server-side authorization.

==================================================

INDIA-SPECIFIC LOCALIZATION

Use:

INR formatting.
Indian number formatting.
Asia/Kolkata timezone.
Indian date display.
Internationalization-ready architecture.

Implement payment-provider integration suitable for India.

Support Razorpay where merchant eligibility and configuration permit.

Prepare billing for applicable GST requirements.

Do not hardcode tax rules.

Keep international currency and language support extensible.

==================================================

SECURITY AND PRIVACY

Implement:

Supabase RLS.
Server-side authorization.
Secure authentication.
Input validation.
XSS protection.
CSRF protection where applicable.
SQL injection protection.
Rate limiting.
Safe redirects.
File upload validation.
Secure cookies.
Secure headers.
Webhook signature verification.
Audit logs.
Secret management.

Apply privacy-by-design.

Provide account data export and deletion.

Provide analytics privacy controls.

Never expose service-role credentials.

Never execute arbitrary user-supplied code.

==================================================

DATABASE

Use PostgreSQL.

Potential entities:

users.
profiles.
profile_settings.
profile_themes.
links.
content_blocks.
social_links.
profile_views.
link_clicks.
analytics_events.
analytics_daily.
custom_domains.
subscriptions.
subscription_plans.
payment_events.
invoices.
leads.
contact_submissions.
notifications.
reports.
moderation_actions.
admin_roles.
audit_logs.

Use UUIDs, foreign keys, indexes, unique constraints, timestamps, and appropriate deletion rules.

Create migrations and document the schema.

Do not blindly create unnecessary tables.

==================================================

PERFORMANCE AND SEO

Optimize public profile pages independently from the dashboard.

Implement:

Server-side rendering or static rendering where appropriate.
Caching.
Optimized images.
Database indexes.
Efficient analytics queries.
Pagination.
Lazy loading.
Core Web Vitals monitoring.

Implement:

Dynamic metadata.
Open Graph.
Canonical URLs.
Sitemap.
Robots configuration.
Indexing controls.

Do not index private or unpublished profiles.

==================================================

TESTING

Use Vitest and Playwright.

Test:

Registration.
Authentication.
Onboarding.
Username availability.
Link creation.
Link editing.
Reordering.
Publishing.
Public profile rendering.
Analytics events.
Theme customization.
QR codes.
Payments.
Subscription entitlements.
User permissions.
Admin permissions.

Run:

Lint.
Type checks.
Unit tests.
Integration tests.
End-to-end tests.
Production builds.

Do not claim successful testing without running the tests.

==================================================

FINAL TECHNICAL STRUCTURE

Use a modular Next.js architecture.

Organize:

Marketing.
Authentication.
Dashboard.
Profile editor.
Public profiles.
Analytics.
Billing.
Admin.
Integrations.
Shared components.
Services.
Database migrations.
Validation.
Tests.

Keep features isolated and maintainable.

Avoid massive components.

==================================================

OFFICIAL DEVELOPMENT ROADMAP

PHASE 1 — FOUNDATION

Repository inspection.
PRD.
Branding.
Architecture.
Database.
Authentication.
Environment setup.

PHASE 2 — MVP

Marketing website.
Onboarding.
Dashboard.
Username management.
Public profiles.
Link management.
Social links.
Core themes.
Publishing.

PHASE 3 — CREATOR EXPERIENCE

Visual editor.
Advanced blocks.
Live preview.
Custom backgrounds.
QR codes.
Sharing.

PHASE 4 — ANALYTICS

Event tracking.
Profile views.
Link clicks.
Dashboard charts.
Reports.

PHASE 5 — INDIA MONETIZATION

INR pricing.
Razorpay.
Subscriptions.
Webhooks.
Billing.
Plan entitlements.

PHASE 6 — BUSINESS FEATURES

Multiple profiles.
Custom domains.
Lead collection.
Admin dashboard.
Moderation.

PHASE 7 — DIFFERENTIATION

AI profile builder.
Theme marketplace.
Advanced analytics.
Creator recommendations.
Additional integrations.

PHASE 8 — PRODUCTION

Security audit.
Performance testing.
Accessibility testing.
Production deployment.
Monitoring.
Documentation.

Do not try to build every advanced feature before the MVP works.

==================================================

CLAUDE CODE OPERATING RULES
Inspect the repository before changing files.
Preserve existing working functionality.
Maintain PROJECT_PLAN.md.
Maintain HANDOFF.md.
Maintain README.md.
Maintain ARCHITECTURE.md.
Maintain DATABASE_SCHEMA.md.
Maintain API_DOCUMENTATION.md.
Maintain SECURITY.md.
Maintain DEPLOYMENT.md.

Build incrementally.

After each phase:

Summarize completed work.
List changed files.
Run relevant tests.
Report errors.
Update the checklist.
Identify the next phase.

Do not generate fake data as production functionality.

Do not leave buttons disconnected.

Do not invent credentials.

Do not claim deployment success without verification.

Ask for approval before major changes to product scope, privacy, architecture costs, or subscription policy.

When external credentials are missing, build the integration safely and document the required configuration.

If the development session ends, write a complete HANDOFF.md describing exact progress and next steps.

==================================================

DEFINITION OF DONE

FindMe MVP is ready for launch when:

Marketing website works.
Authentication works.
Onboarding works.
Username management works.
Creator dashboard works.
Link management works.
Public profiles work.
Themes work.
Content blocks work.
Publishing works.
QR generation works.
Core analytics work.
Database security is implemented.
Admin authorization works.
Responsive layouts work.
Critical tests pass.
Production build succeeds.
Deployment documentation exists.

Paid functionality must be tested with provider sandbox credentials before being advertised as operational.

==================================================

FIRST ACTION

Begin by inspecting the existing repository.

Do not immediately generate all application files.

First create:

PRD.md
PROJECT_PLAN.md
ARCHITECTURE.md
DATABASE_SCHEMA.md
API_DOCUMENTATION.md
SECURITY.md
DEPLOYMENT.md

Then present the architecture and implementation roadmap.

Identify any missing credentials or decisions.

Once the foundation is established, start implementing Phase 1 and proceed incrementally.

FINAL MISSION:

Build FindMe into an exceptional, India-first, globally scalable link-in-bio SaaS platform.

The dashboard must feel premium and minimalist.

The public profiles must feel creative and beautiful.

The backend must be secure and reliable.

The product must be genuinely useful.

Do not build just another Linktree clone.

Build FindMe into a complete creator platform.

YOUR ENTIRE WORLD. ONE LINK.
