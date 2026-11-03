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
- ✅ Admin role table writable only by service role.
- 🗓️ Admin panel server-side role checks (Phase 4 for the basics, Phase 6 for the panel).

### Input and output

- ✅ Zod validation on the server for every action.
- ✅ Username rules enforced in both Zod and the database.
- ✅ `safeRedirectPath` blocks absolute, protocol-relative, backslash and encoded redirects.
- 🗓️ URL scheme allow-list for links and embed-provider allow-list (Phase 2–3).
- 🗓️ File upload validation: type sniffing, size limits, per-user storage paths (Phase 2).

### Platform

- ✅ Security headers: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. 🔶 HSTS is sent only in production mode and hasn't been checked over HTTPS.
- ✅ CSRF: Server Actions check Origin against Host (a built-in Next.js protection we rely on and haven't separately tested); auth cookies are `SameSite=Lax`.
- ✅ SQL injection: all DB access is parameterised through PostgREST or RPC; dynamic SQL is not used.
- ✅ Rate limiting on auth, username checks and credential changes, tested end to end. If the limiter is unreachable, these endpoints **fail closed**.
- ✅ Secrets come from the environment only, `.env*` is gitignored, and logs redact secret-looking keys.
- ✅ Append-only `audit_logs`.

### Privacy (India DPDP Act in mind — not a legal opinion)

- ✅ Versioned consent to Terms and Privacy is recorded with a timestamp.
- 🗓️ No raw IPs in analytics; daily-rotating visitor hash; retention job (Phase 4).
- 🗓️ Internal previews excluded from analytics (Phase 4).
- 🗓️ Account data export and self-service deletion (Phase 6). **Must ship before public launch.**
- 🗓️ Lawyer review of legal text (Phase 8).

## Known gaps and accepted risks

These are open and will be re-reviewed in the Phase 8 audit.

1. **CSP includes `'unsafe-inline'` for scripts.** Nonces would make every page dynamic and defeat caching of public profiles. Mitigated by React escaping and no raw user HTML.
2. **Reserved usernames are an exact-match list.** Substring matching causes false positives on legitimate names, so determined look-alikes are left to moderation (Phase 6).
3. **Client IP comes from `x-forwarded-for`,** which is only trustworthy behind Vercel. Self-hosting requires reviewing `src/lib/security/client-ip.ts`.
4. **Username release.** A renamed username becomes available immediately, so it could be claimed for impersonation. A cool-down is due when rename ships.
5. **Audit log writes aren't wired up yet.** The append-only table exists, but nothing writes to it, because no admin actions exist so far. Phase 6 must make admin actions and their audit entries atomic.
6. **Suspended accounts can still write through the API.** A suspended user is locked out of the app and their page is hidden from the public, but RLS policies don't check account status, so a direct API call could still edit their own rows. To be closed in Phase 2, before user content tables ship.
7. **Consent can be self-asserted through direct signup.** Someone calling the Auth API directly can put consent versions in their signup metadata. They are asserting consent for themselves, so this is low risk, but the record shows only what the client sent.
8. **Dev tooling audit findings.** `npm audit` reports moderate findings in the ESLint and shadcn CLI toolchains. These are dev dependencies and don't ship to users. `npm audit --omit=dev` is clean as of 2026-11-03. The automated fixes are major downgrades, so they haven't been applied.

## Pre-launch checklist

- [ ] Service-role key only in Vercel server environment variables
- [ ] Supabase: "Confirm email" on, secure password change on, leaked password protection on if the plan allows it
- [ ] Redirect URL allow-list has production and intended preview origins only
- [ ] Razorpay webhook secret set; live keys only in production
- [ ] Independent security review, and `npm audit` reviewed
- [ ] Legal pages reviewed and the draft banner removed
