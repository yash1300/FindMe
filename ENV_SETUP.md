# Getting your `.env` values

This guide shows where to get every value FindMe needs through Phase 3. Budget about 30 minutes. Website screens change over time, so a label may differ slightly from what's written here.

## Which file to edit

Put your values in **`.env.local`**, in the project's root folder. That file already exists and is pointing at the local test database.

> **Don't create a separate `.env` file for this.** Next.js gives `.env.local` priority over `.env`, so anything you put in `.env` would be ignored while `.env.local` has the same names.

Both files are excluded from Git, so your secrets won't be pushed. **Never paste the secret values into chat, code, or a screenshot.**

After changing any value, restart `npm run dev`, or run `npm run build` again. `NEXT_PUBLIC_` values are fixed when the app is built.

## What you need

| Variable | Required? | Secret? | Get it from |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | **Yes** | No | [Step 1](#step-1-your-site-address) |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | No | [Step 2](#step-2-supabase) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | No, public by design | [Step 2](#step-2-supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Yes** | [Step 2](#step-2-supabase) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Before launch | No | [Step 3](#step-3-support-email) |
| `RESEND_API_KEY` | Recommended | **Yes** | [Step 4](#step-4-resend-email) |
| `EMAIL_FROM` | With Resend | No | [Step 4](#step-4-resend-email) |
| `CONTACT_INBOX_EMAIL` | Optional | No | [Step 4](#step-4-resend-email) |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | Optional | No | [Step 5](#step-5-google-sign-in-optional) |

Without the optional values, the app still works, but no notification emails go out and the Google button stays hidden. Nothing is lost: messages from creators' page forms appear under **Audience**, and messages from your site's Contact page are saved in the `contact_submissions` table, which you can view in Supabase's Table Editor until the admin panel arrives in Phase 6.

---

## Step 1: Your site address

```env
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
```

- **On your computer:** keep the value above.
- **Once deployed:** use your real address, such as `https://your-project.vercel.app` or your own domain. No slash at the end.

All links, emails and QR codes are built from this value.

## Step 2: Supabase

Supabase holds your database, logins and uploaded images. The free plan is enough to start.

1. Go to <https://supabase.com> and sign up.
2. Click **New project**.
   - **Name:** `findme`, or anything you like.
   - **Database password:** generate a strong one and **save it in a password manager**. Step 2.5 needs it.
   - **Region:** Mumbai (`ap-south-1`) if it's offered, since it's closest to your users in India.
3. Wait a minute or two for it to finish setting up.
4. Open **Project Settings → API** (it may be called **API Keys**) and copy:

   | Copy this | Into this |
   | --- | --- |
   | **Project URL** (`https://xxxx.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` |
   | **anon public** key (may be called **publishable**) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | **service_role** key (may be called **secret**) | `SUPABASE_SERVICE_ROLE_KEY` |

   > **Keep the service role key secret.** It bypasses all database security. If it ever leaks, rotate it in this same screen straight away.

5. **Create the tables.** Your new project starts empty. In the project folder, run:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push --remote
   ```

   `YOUR_PROJECT_REF` is the `xxxx` part of your Project URL. `link` asks for the database password from step 2.

6. **Set the login redirects.** Under **Authentication → URL Configuration**:
   - **Site URL:** the same value as `NEXT_PUBLIC_APP_URL`.
   - **Redirect URLs:** add `http://127.0.0.1:3000/auth/callback**`, and later also `https://your-domain/auth/callback**`. Keep the two stars at the end.

7. **Turn on email confirmation.** Under **Authentication → Providers → Email** (it may be under **Sign In / Providers**):
   - Turn on **Confirm email** and **Secure password change**.
   - Set the minimum password length to **10**.

8. **Update the email templates.** This step is required, because without it the links in your emails won't work. Under **Authentication → Email Templates**, paste the contents of these files into the matching template:

   | Template | File in this project |
   | --- | --- |
   | Confirm signup | `supabase/templates/confirmation.html` |
   | Reset password | `supabase/templates/recovery.html` |
   | Change email address | `supabase/templates/email_change.html` |

> **Email limit:** Supabase's built-in sender only allows a few emails an hour, which is fine for a quick trial but not for real users. Step 4 removes that limit.

## Step 3: Support email

```env
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
```

Any inbox you check. It appears on the Privacy Policy and on the page shown to suspended accounts. Leave it empty while you're testing.

## Step 4: Resend (email)

Resend sends notification emails when someone uses a contact form, and provides reliable sending for sign-up emails.

**You need a domain you own** to send to real users. Without one, Resend only lets you send to your own address.

1. Sign up at <https://resend.com>.
2. Open **Domains → Add Domain** and enter your domain. Add the DNS records it shows at your domain provider, then wait for it to verify.
3. Open **API Keys → Create API Key**. Copy it straight away, since it's shown only once.
4. Fill in:

   ```env
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM=FindMe <hello@yourdomain.com>
   CONTACT_INBOX_EMAIL=you@yourdomain.com
   ```

   `CONTACT_INBOX_EMAIL` is where messages from your site's Contact page go.

5. **Use Resend for sign-up emails too.** In Supabase, open **Authentication → SMTP Settings** (it may be under **Emails**), turn on custom SMTP, and enter the details from Resend's **SMTP** page. The password is your API key. Then raise the email rate limit under **Authentication → Rate Limits**.

## Step 5: Google sign-in (optional)

1. Go to <https://console.cloud.google.com> and create a project.
2. Open **APIs & Services → OAuth consent screen** and fill it in. Choose **External**.
3. Open **Credentials → Create Credentials → OAuth client ID**, and choose **Web application**.
4. Under **Authorized redirect URIs**, add:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

5. Copy the **Client ID** and **Client Secret**. These go **into Supabase, not into your `.env.local`**: open **Authentication → Providers → Google**, turn it on, and paste them in.
6. Finally, turn on the button:

   ```env
   NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
   ```

---

## Your finished `.env.local`

```env
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
NEXT_PUBLIC_SUPPORT_EMAIL=
RESEND_API_KEY=
EMAIL_FROM=
CONTACT_INBOX_EMAIL=
```

## Check that it worked

1. Run `npm run dev`, and open <http://127.0.0.1:3000/api/health>. You should see `{"status":"ok","database":"ok"}`.
   - **`degraded`:** check the three Supabase values, and that `npx supabase db push --remote` succeeded.
2. Open <http://127.0.0.1:3000/register> and create an account using a real email address.
3. Follow the link in the email. You should arrive at the setup wizard.
   - **No email:** check your spam folder, then the Supabase rate limit.
   - **The link goes to the login page with an error:** recheck the email templates and redirect URLs from step 2.
4. Finish the wizard and publish, then open your page in a private window.

**The automated browser tests only run against the local database.** They create and delete data, so they refuse to run against your real project. To run them again, swap the local values back into `.env.local`; `npx supabase status -o env` prints them. Keeping a copy of your real values somewhere safe makes this easy.

## Later phases

These aren't needed yet:

| Needed for | What |
| --- | --- |
| Going live | **Add these same values in Vercel, under Project → Settings → Environment Variables, then redeploy.** `.env.local` is only on your computer, so Vercel can't see it. Set `NEXT_PUBLIC_APP_URL` there to your live address. See [DEPLOYMENT.md](DEPLOYMENT.md) |
