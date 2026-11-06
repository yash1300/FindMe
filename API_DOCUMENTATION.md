# FindMe — API Documentation

Most mutations are **Server Actions**, which are not a public API. Route handlers exist only where something outside the React tree must call in (health checks, OAuth redirects, webhooks, beacons).

**Conventions:** JSON bodies; errors look like `{ "error": { "code": "…", "message": "…" } }`. Rate-limited responses return `429` with a `Retry-After` header. Dates are ISO 8601 in UTC.

## Implemented

### `GET /api/health`

Liveness and database reachability. Reveals no configuration or version details.

| Status | Body |
| --- | --- |
| 200 | `{ "status": "ok", "database": "ok" }` |
| 503 | `{ "status": "degraded", "database": "unreachable" }` |

Never cached.

### `GET /api/usernames/check?username={name}`

Availability check used by registration and onboarding. Rate limited per client IP.

| Status | Body |
| --- | --- |
| 200 | `{ "available": true, "username": "asha" }` |
| 200 | `{ "available": false, "reason": "taken" }` |
| 200 | `{ "available": false, "reason": "invalid", "message": "…" }` |
| 429 | Rate limited |
| 503 | Service unavailable, e.g. the database is unreachable or not configured |

Reserved and prohibited names return the `invalid` reason with a generic message, without saying which list matched.

### `GET /auth/callback`

Browser redirect target for Google OAuth and email links. Takes either `code` (PKCE) or `token_hash` and `type` (`signup`, `email`, `recovery`, `email_change`), plus an optional `next` path. `next` passes through `safeRedirectPath`, so only same-origin relative paths are honoured, and redirects are built from `NEXT_PUBLIC_APP_URL` rather than the Host header. A recovery link also sets a 15-minute `HttpOnly` marker cookie, which `resetPasswordAction` requires. On failure it redirects to `/login?error=auth_callback`. If Google or Supabase reports an `error` (such as a cancelled sign-in), it redirects to `/login?error=oauth_cancelled`.

### `POST /auth/signout`

Plain form post from the Log out buttons. Rejects cross-site requests (403), ends this browser's Supabase session (`scope: "local"`), deletes every `sb-*` cookie and the selected-page cookie whatever Supabase replied, and answers `303` to `/`. It sits outside the paths where `proxy.ts` renews sessions, so a renewal can't set a fresh cookie in the same response.

### `GET /dashboard/analytics/export?range=…&from=…&to=…`

The selected page's daily figures for the range as CSV: one row per day and measure (total, referrer, device, browser, os, country, link), with links named. Owner only, read under RLS. Cells that a spreadsheet could run as formulas are prefixed with `'`.

## Server Actions

All of these validate with Zod on the server. Form actions return `{ status: "success" | "error", message?, fieldErrors?, values?, code?, email? }` (see `src/features/auth/action-state.ts`), or redirect on success. Passwords are never echoed back. Next.js checks that the Origin matches the Host for all of them.

| Action | Auth | Rate limit | Notes |
| --- | --- | --- | --- |
| `registerAction` | None | IP | Same response whether or not the email exists |
| `loginAction` | None | IP and email | Generic error for bad credentials |
| `signInWithGoogleAction` | None | IP | Redirects to Google |
| `requestPasswordResetAction` | None | IP and email | Same response whether or not the email exists |
| `resetPasswordAction` | Recovery session | — | |
| `resendVerificationAction` | None | IP and email | Same response whether or not the email exists |
| `completeOnboardingAction` | User | User | Creates the first profile and records consent, whichever is missing according to the server |
| `updateAccountNameAction` | User | — | Protected by RLS and column grants |
| `changePasswordAction` | User | User | Re-checks the current password |
| `changeEmailAction` | User | User | The new address must confirm |

### Editor actions

These take typed objects rather than forms, and return `{ ok: true, ... }` or `{ ok: false, code?, message, fieldErrors? }`, where `code` can be `conflict` or `rate_limited`. Every one checks the session and account itself, and invalidates the public page's cache.

| Action | Rate limit | Notes |
| --- | --- | --- |
| `createBlockAction`, `updateBlockAction` | User | Validated against the block's schema. Images must be the user's own uploads |
| `setBlockVisibilityAction`, `deleteBlockAction`, `duplicateBlockAction` | User | |
| `reorderBlocksAction` | User | Returns `conflict` if the list is out of date, and the client rolls back |
| `saveSocialLinkAction` | User | Adds or updates. The link must really go to that platform's site |
| `setSocialVisibilityAction`, `deleteSocialLinkAction`, `reorderSocialLinksAction` | User | Hiding or removing a link does the same to the button made for it |
| `addSocialButtonsAction` | User | Adds a button for each social link that lacks one |
| `showSocialIconsAction` | User | Shows the hidden Social icons block, or adds one at the top |
| `shareThemeAction`, `removeSharedThemeAction` | User | Shares the saved theme to the gallery (without photos), or stops sharing it. Ten per person |
| `applyGalleryThemeAction` | User | Replaces the selected page's theme with a gallery theme, validated again first |
| `uploadMediaAction` | User, 40 an hour | `FormData`. Up to 5 MB. Type comes from the file's bytes |
| `updateProfileDetailsAction`, `saveThemeAction` | User | Require the version the edit started from, and return `conflict` if it's stale |
| `changeUsernameAction` | User | One a day. Old name held for 30 days |
| `setPublishStatusAction` | User | Published or unpublished. Can't lift a suspension |
| `completeWizardAction` | — | Finishes onboarding, optionally publishing |

### Page, domain and account actions

| Action | Notes |
| --- | --- |
| `createPageAction`, `switchPageAction`, `deletePageAction` | The page cookie only selects among pages RLS allows. Deleting needs the username typed, and you can't delete your last page |
| `addDomainAction`, `verifyDomainAction`, `removeDomainAction` | Verification looks up the `_findme` TXT record, then attaches the domain to Vercel if configured |
| `deleteAccountAction` | Needs "DELETE" typed, and the password if there is one. Removes files, then the login, which cascades |
| `submitReportAction` | Public. Rate limited, with a spam trap. A link is only recorded if it's on that page |

### Admin actions

Each checks the staff role on the server, requires a reason, and calls a database function that saves the change and its log entry together: `setAccountStatusAction`, `setProfileSuspendedAction`, `hideBlockAction`, `closeReportAction`, `removeSharedThemeAsStaffAction`, and `updateSettingsAction` (admins only).

### Public form actions

| Action | Rate limit | Notes |
| --- | --- | --- |
| `submitLeadAction` | IP, and IP per form | Reads the form through `public_blocks`, so hidden or expired forms can't collect anything. Includes a spam trap. Repeats get the same reply |
| `deleteLeadAction` | — | Owner only |
| `submitContactAction` | IP | Stored first, then emailed if Resend is configured |

### Generated routes

`GET /sitemap.xml` lists marketing pages and indexable published profiles, cached for up to an hour. `GET /robots.txt` excludes private areas.

### `POST /api/events`

Page-view beacon, sent by public pages after loading. Takes `{ profileId, referrer? }`. Only accepts requests from the app's own origin. Returns `204` immediately and records after responding; `400`, `403` or `413` for bad requests. Bots and visitors sending Global Privacy Control or Do Not Track aren't counted, and events are rate limited per IP.

### `GET /l/{blockId}`

Counts a click, then returns a `302` to the block's **stored** address, after validating it again. Nothing in the request can change the destination, so it can't be an open redirect. Returns `404` for unknown, hidden, expired or unpublished links.

### `GET /api/leads/export`

The current page's signups and messages as CSV. Needs a session; RLS limits it to the user's own data. Cells that spreadsheets would run as formulas are neutralised. Returns `401` when signed out, and `429` over 10 an hour.

### `GET /api/account/export`

Everything held for the signed-in user, as JSON. Same limits.

### `GET /api/cron/maintenance`

Daily cleanup, called by Vercel Cron. Requires `Authorization: Bearer {CRON_SECRET}`, and returns `401` otherwise, including when no secret is set.

### Custom domain routing

On any host that isn't the app's own, `/` serves the page mapped to that domain, or a 404. `/l/*`, `/report` and `/api/events` pass through. Everything else, including sign-in, redirects to the main site.

### `GET /{username}`

The public page. Returns **404** for unknown, draft, unpublished or suspended pages, and a **308** to the lowercase address for names in other cases.

## Planned

| Endpoint | Phase | Purpose |
| --- | --- | --- |
