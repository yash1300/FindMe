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

Browser redirect target for Google OAuth and email links. Takes either `code` (PKCE) or `token_hash` and `type` (`signup`, `email`, `recovery`, `email_change`), plus an optional `next` path. `next` passes through `safeRedirectPath`, so only same-origin relative paths are honoured, and redirects are built from `NEXT_PUBLIC_APP_URL` rather than the Host header. A recovery link also sets a 15-minute `HttpOnly` marker cookie, which `resetPasswordAction` requires. On failure it redirects to `/login?error=auth_callback`.

## Server Actions

All of these validate with Zod on the server. Form actions return `{ status: "success" | "error", message?, fieldErrors?, values?, code?, email? }` (see `src/features/auth/action-state.ts`), or redirect on success. Passwords are never echoed back. Next.js checks that the Origin matches the Host for all of them.

| Action | Auth | Rate limit | Notes |
| --- | --- | --- | --- |
| `registerAction` | None | IP | Same response whether or not the email exists |
| `loginAction` | None | IP and email | Generic error for bad credentials |
| `signInWithGoogleAction` | None | IP | Redirects to Google |
| `signOutAction` | User | — | |
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
| `setSocialVisibilityAction`, `deleteSocialLinkAction`, `reorderSocialLinksAction` | User | |
| `uploadMediaAction` | User, 40 an hour | `FormData`. Up to 5 MB. Type comes from the file's bytes |
| `updateProfileDetailsAction`, `saveThemeAction` | User | Require the version the edit started from, and return `conflict` if it's stale |
| `changeUsernameAction` | User | One a day. Old name held for 30 days |
| `setPublishStatusAction` | User | Published or unpublished. Can't lift a suspension |
| `completeWizardAction` | — | Finishes onboarding, optionally publishing |

### Public form actions

| Action | Rate limit | Notes |
| --- | --- | --- |
| `submitLeadAction` | IP, and IP per form | Reads the form through `public_blocks`, so hidden or expired forms can't collect anything. Includes a spam trap. Repeats get the same reply |
| `deleteLeadAction` | — | Owner only |
| `submitContactAction` | IP | Stored first, then emailed if Resend is configured |

### Generated routes

`GET /sitemap.xml` lists marketing pages and indexable published profiles, cached for up to an hour. `GET /robots.txt` excludes private areas.

### `GET /{username}`

The public page. Returns **404** for unknown, draft, unpublished or suspended pages, and a **308** to the lowercase address for names in other cases.

## Planned

| Endpoint | Phase | Purpose |
| --- | --- | --- |
| `POST /api/events` | 4 | View beacon: filters bots, removes duplicates, never trusts client IDs without checking |
| `GET /l/{blockId}` | 4 | Click tracking and redirect to the **stored** URL only |
| `POST /api/webhooks/razorpay` | 5 | Signature-verified, idempotent |
| `GET /api/leads/export` | 6 | CSV for the owner, strict authorisation |
| `GET /api/account/export` | 6 | Personal data export |
