# FindMe — Security

Status per control: ✅ implemented and tested, including against the local Supabase stack where relevant · 🔶 implemented but not verified · 🗓️ planned, with its phase.

**Nothing here has been tested on a hosted deployment yet.** "Tested" means automated tests against a local stack.

**Reporting a vulnerability:** contact details will be published before launch (see PRD open decision 6). Do not open a public issue.

## Threat model

| Threat | Main defence |
| --- | --- |
| A user reads or edits another user's data | RLS on every table, tested with real role switching |
| A user bypasses the app by calling PostgREST with the public anon key | RLS, column grants, triggers and `CHECK` constraints enforce rules in the database |
| A user escalates privileges or lifts a suspension | Column grants; `guard_profile_status`; `admin_roles` writable only by service role |
| Malicious links (`javascript:`, phishing via open redirect) | Scheme allow-list on write and at render; redirects use stored URLs only |
| XSS through profile content | React escaping; no raw user HTML; embed-provider allow-list |
| Service-role key exposure | `server-only` guard; never `NEXT_PUBLIC_`; a test scans client code |
| Credential stuffing and sign-up abuse | Rate limits; generic errors; email verification |
| Forged payment events | Webhook signature check; access changes only from webhooks |
| Admin abuse | Server-side role checks; append-only audit log |

## Controls

### Authentication and sessions

- ✅ Password policy: 10–72 **bytes** (bcrypt ignores anything past 72), enforced in the shared schema.
- ✅ Supabase Auth, with cookies managed by `@supabase/ssr`. Check the `Secure` and `HttpOnly` flags on the first HTTPS deployment.
- ✅ Email verification and password recovery. The reset form also requires a short-lived marker from the emailed link, and changing a password signs out other sessions.
- 🔶 Google OAuth. Written but never run, because it needs credentials. Hidden until enabled.
- ✅ No user enumeration in messages from registration, password reset or verification resend.
- ✅ Server code uses `getUser()`, which validates the token with Supabase, instead of trusting `getSession()`.

### Authorisation

- ✅ RLS enabled on every table, with default-deny; tests cover anonymous and cross-tenant access.
- ✅ Column-level grants on `accounts`.
- ✅ Suspended status cannot be set or cleared by the user.
- ✅ Public reads go through a view that excludes `owner_id`.
- ✅ Suspended accounts can't write, even by calling the API directly.
- ✅ Admin role table writable only by service role.
- ✅ Every admin page and action checks the role on the server, and others see a not-found page. Settings are admin-only.
- ✅ Admin actions and their audit entries save in one transaction, so nothing can happen unlogged. Staff can't suspend themselves or each other.
- ✅ Nobody can mark their own domain verified, and domains under the app's or hosting provider's names are refused.

### Input and output

- ✅ Zod validation on the server for every action.
- ✅ Username rules enforced in both Zod and the database.
- ✅ `safeRedirectPath` blocks absolute, protocol-relative, backslash and encoded redirects.
- ✅ URLs: only public http(s) addresses are accepted, with no embedded credentials. Checked on write, at render, and for `url` fields by a database `CHECK`.
- ✅ Embeds: built only from validated IDs for YouTube, Vimeo, Spotify and SoundCloud, sandboxed, and limited by the CSP's `frame-src`. Video players load only on press.
- ✅ Social links must really point to the named platform's site. This doesn't confirm who owns the account, and we never claim it does.
- ✅ Themes are data, never CSS: only strict hex colours and fixed options are accepted.
- ✅ Uploads: type detected from file bytes, 5 MB limit, no SVG, per-user folders enforced by storage policies.
- ✅ Public forms: consent required and recorded, rate limited, spam trap, and server-side checks that the form is live.
- ✅ User text is escaped by React, confirmed by a test that stores script tags and checks they don't run.

### Platform

- ✅ Security headers: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. 🔶 HSTS is sent only in production mode and hasn't been checked over HTTPS.
- ✅ CSRF: Server Actions check Origin against Host (a built-in Next.js protection we rely on and haven't separately tested); auth cookies are `SameSite=Lax`.
- ✅ SQL injection: all DB access is parameterised through PostgREST or RPC; dynamic SQL is not used.
- ✅ Rate limiting on auth, username checks and credential changes, tested end to end. If the limiter is unreachable, these endpoints **fail closed**.
- ✅ Secrets come from the environment only, `.env*` is gitignored, and logs redact secret-looking keys.
- ✅ Append-only `audit_logs`.

### Privacy (India DPDP Act in mind — not a legal opinion)

- ✅ Versioned consent to Terms and Privacy is recorded with a timestamp.
- ✅ Analytics stores no IP address or user agent. Visitors are a salted hash that differs per page and rotates daily, and old salts are destroyed. Tested at database level.
- ✅ Raw events are deleted after 30 days, leaving only daily totals. Tested at database level.
- ✅ Bots, previews, Global Privacy Control and Do Not Track are excluded, and creators can turn analytics off.
- ✅ Account data export and self-service deletion. Deletion needs the password where there is one.
- ✅ Form submissions record the exact consent wording and time. Creators can delete them.
- ✅ No third-party video code loads until a visitor presses play. Spotify and SoundCloud players load with the page, and the Privacy Policy says so.
- 🗓️ Lawyer review of legal text (Phase 8).

## Hosted database audit (2026-11-04)

Run against the live Supabase project, on the schema before the analytics migration.

- **58 of 58 attacks were blocked**, using real sessions for two temporary users and anonymous calls: cross-user reads and writes, privilege escalation, forged fields, dangerous URLs, storage abuse, and suspended accounts. The temporary users were then deleted.
- **Catalogue checked directly:** RLS is on for all 11 tables. Anonymous users can't write to anything and can read only the three `public_*` views. Signed-in users can write only the expected columns. All `SECURITY DEFINER` functions pin their `search_path`.
- **Also confirmed:** storage allows no SVG, has a 5 MB limit, and has no listing for others; GraphQL exposes nothing to anonymous users; nothing is published to Realtime.
- `rls_auto_enable` is executable by clients but harmless. Supabase created it as an event trigger that turns on RLS for new tables, and it can't be called directly.
- **Not covered by this audit:** the Auth dashboard settings, such as password length and email templates, which aren't readable with these keys. Check them against ENV_SETUP.md.

**This audit predates the analytics and Phase 6 migrations, which aren't applied to the hosted database yet. Re-run it afterwards.**

## Known gaps and accepted risks

These are open and will be re-reviewed in the Phase 8 audit.

1. **CSP includes `'unsafe-inline'` for scripts.** Nonces would make every page dynamic and defeat caching of public profiles. Mitigated by React escaping and no raw user HTML.
2. **Reserved usernames are an exact-match list.** Substring matching causes false positives on legitimate names, so determined look-alikes are left to moderation (Phase 6).
3. **Client IP comes from `x-forwarded-for`,** which is only trustworthy behind Vercel. Self-hosting requires reviewing `src/lib/security/client-ip.ts`.
4. **Uploaded images keep their metadata.** Photos can carry location data in EXIF. The original stays reachable at its public storage URL, even if the optimised copies visitors normally load drop it (not verified). Stripping it on upload needs an image-processing step, due before launch.
5. **Audit log writes aren't wired up yet.** The append-only table exists, but nothing writes to it, because no admin actions exist so far. Phase 6 must make admin actions and their audit entries atomic.
6. **Storage isn't cleaned up or capped per user.** Replaced images stay in storage, and uploads are limited by rate rather than total size.
7. **Consent can be self-asserted through direct signup.** Someone calling the Auth API directly can put consent versions in their signup metadata. They are asserting consent for themselves, so this is low risk, but the record shows only what the client sent.
8. **Malformed URLs return 500.** A single path segment that can't be percent-decoded, like `/%E0%A4%A`, gets a generic 500 from the framework before our code runs. It exposes nothing, and only scanners send these.
9. **Custom domains are unproven with real DNS, the Vercel API and HTTPS,** which all need credentials and a real domain. Server actions on a custom domain, such as a contact form submitted from one, also haven't been tested.
11. **The first admin must be created with SQL.** This is deliberate, and there's no screen for it. See DEPLOYMENT.md.
12. **Unconfirmed accounts are deleted after 30 days** by the maintenance job. It only touches accounts that never confirmed and never signed in, but the cleanup itself hasn't been run yet.
10. **Dev tooling audit findings.** `npm audit` reports moderate findings in the ESLint and shadcn CLI toolchains. These are dev dependencies and don't ship to users. `npm audit --omit=dev` is clean as of 2026-11-03. The automated fixes are major downgrades, so they haven't been applied.

## Pre-launch checklist

- [ ] Service-role key only in Vercel server environment variables
- [ ] Supabase: "Confirm email" on, secure password change on, leaked password protection on if the plan allows it
- [ ] Redirect URL allow-list has production and intended preview origins only
- [ ] Independent security review, and `npm audit` reviewed
- [ ] Legal pages reviewed and the draft banner removed
