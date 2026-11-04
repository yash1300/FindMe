# FindMe — Deployment

> **Status: nothing has been deployed.** The local stack has been verified end to end, including the migration and email templates. The hosted Supabase, Vercel and Google steps below have not been run yet, so expect dashboard labels to differ. They'll be marked as verified once they have been.

## Environment variables

**Step-by-step instructions for getting every value are in [ENV_SETUP.md](ENV_SETUP.md).** Copy `.env.example` to `.env.local` for local work. In Vercel, set these per environment. `src/lib/env.ts` validates them when they're used. **`NEXT_PUBLIC_*` values are fixed at build time, so redeploy after changing them.**

| Variable | Exposure | Needed | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public | Yes | Canonical origin, e.g. `https://findme.com`. No trailing slash |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Publishable key. Safe only because RLS is enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Yes | Rate limiting and later admin tasks. **Never** prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | Public | No | `true` shows the Google button. Leave unset until Google is configured |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Public | Before launch | Shown on the privacy and suspension pages. Hidden when unset |
| `RESEND_API_KEY` | **Secret** | Recommended | Notification emails. Without it, messages are still saved |
| `EMAIL_FROM` | Server | With Resend | Sender, on a domain verified in Resend |
| `CONTACT_INBOX_EMAIL` | Server | Optional | Where marketing Contact page messages are sent |

## Local development

Requirements: Node.js 22.12 or later, and Docker Desktop running for the local Supabase stack.

```bash
npm install
npx supabase start          # prints local URL, anon key and service-role key
cp .env.example .env.local  # paste those values in
npm run dev
```

Local email goes to the Mailpit inbox at http://127.0.0.1:54324. Nothing is really sent.

## Supabase setup

1. Create a project in an Indian region if available (Mumbai, `ap-south-1`), for latency and data locality. Use separate projects for staging and production.
2. Apply the schema:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push --remote
   ```

3. **Authentication → URL configuration**
   - Site URL: your `NEXT_PUBLIC_APP_URL`
   - Redirect URLs: `{origin}/auth/callback**` for each environment. The wildcard is needed because the callback carries a `next` parameter
4. **Authentication → Sign In / Providers → Email:** turn on "Confirm email" and "Secure password change". Set the minimum password length to 10.
5. **Email templates:** make the Confirm signup, Reset password and Change email templates link to our callback, which is what makes verification work across browsers and devices:

   ```text
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change
   ```

   The local stack gets the same links from `supabase/templates/`. Those files can be pasted into the dashboard. Some email security scanners open links automatically, which can use up a one-time link. If users report expired links, this is the first thing to check.
6. **Custom SMTP (required for production).** Supabase's built-in email is heavily rate limited and meant for testing only. Configure Resend's SMTP details under Authentication → SMTP, using a verified sending domain.
7. **Rate limits:** auth calls come from Vercel's servers rather than end users, so Supabase's per-IP limits apply to all users together. Raise the sign-in and sign-up limits under Authentication → Rate Limits. FindMe's own per-client limiter is the real control. Check current limit names in the dashboard, as they can change.

## Google OAuth

1. In Google Cloud Console, create an OAuth client of type Web application.
2. Set the authorised redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Paste the client ID and secret into Supabase → Authentication → Providers → Google.
4. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` and redeploy.

## Vercel

1. Import the GitHub repository. The framework is detected as Next.js.
2. Add the variables above for Production and Preview, pointing Preview at the staging Supabase project.
3. Attach the domain, then update `NEXT_PUBLIC_APP_URL` and the Supabase URL settings to match.
4. Consider Mumbai (`bom1`) as the function region, close to the database.

## Making someone an admin

There's no screen for this on purpose. In the Supabase SQL editor, using the user's ID from Authentication → Users:

```sql
insert into public.admin_roles (user_id, role) values ('USER-ID-HERE', 'admin');
```

## Verifying a deployment

Do not call a deployment successful until all of these pass.

```bash
curl -s https://<origin>/api/health      # {"status":"ok","database":"ok"}
curl -sI https://<origin>/               # security headers are present
```

- [ ] Register a new account and receive the verification email.
- [ ] The link signs you in and lands in onboarding.
- [ ] Log out, log back in, and reset the password.
- [ ] `/dashboard` redirects to login when signed out.
- [ ] Google sign-in works, if enabled.

## Rollback

- **App:** promote the previous deployment in Vercel.
- **Database:** migrations only go forward. Write a new fixing migration and never edit one that has been applied. Take a backup before any destructive migration, and do not drop user data to simplify a change.
