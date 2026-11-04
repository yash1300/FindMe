# FindMe — Database Schema

PostgreSQL on Supabase. All changes go through `supabase/migrations/`. Primary keys are UUIDs and timestamps are `timestamptz` (stored in UTC, displayed in Asia/Kolkata).

**Status:** ✅ migrated and tested · 🗓️ designed, created in the listed phase. Planned tables may change when their phase is built, and no table is created before it is needed.

## Implemented

Migration: [`supabase/migrations/20261103000000_foundation.sql`](supabase/migrations/20261103000000_foundation.sql)

### `accounts` ✅

One row per `auth.users` row, created by trigger. Replaces the spec's `users`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | FK to `auth.users`, cascade delete |
| `display_name` | text | 1–80 characters |
| `status` | `account_status` | `active` or `suspended`; users cannot change it |
| `terms_accepted_version` | text, null | Consent record |
| `terms_accepted_at` | timestamptz, null | Consent record |
| `privacy_accepted_version` | text, null | Consent record |
| `privacy_accepted_at` | timestamptz, null | Consent record |
| `locale` | text | Default `en-IN` |
| `timezone` | text | Default `Asia/Kolkata` |
| `currency` | text | Default `INR` |
| `created_at`, `updated_at` | timestamptz | |

**RLS:** a user reads and updates only their own row. Column grants restrict updates to `display_name`, `locale` and `timezone`. Consent changes go through `record_consent()`, which stamps the server's time.

### `profiles` ✅

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `owner_id` | uuid | FK to `accounts`, cascade delete |
| `username` | text, unique | Stored lowercase; see the rules below |
| `display_name` | text | 1–80 characters |
| `bio` | text, null | Up to 300 characters |
| `avatar_path`, `cover_path` | text, null | Storage paths, not URLs |
| `category` | text, null | Creator category |
| `status` | `profile_status` | `draft`, `published`, `unpublished`, `suspended` |
| `theme` | jsonb | Validated theme document; must be a JSON object |
| `published_at` | timestamptz, null | |
| `created_at`, `updated_at` | timestamptz | |

**RLS:** owners have full access to their own rows, except that:

- `guard_profile_status` stops anyone but the service role from setting or clearing `suspended`.
- `enforce_profile_limit` allows one profile per account until entitlements arrive in Phase 5.

Other users and anonymous visitors **cannot read this table**. They use `public_profiles`, which leaves out `owner_id`.

### `public_profiles` view ✅

Safe public columns of `published` profiles whose account is `active`. Granted to `anon` and `authenticated`.

### `reserved_usernames` ✅

`name` (PK), `kind` (`reserved` or `prohibited`). Readable and writable only by the service role. Contains every top-level route, so a username can never shadow a page; a test enforces this.

### `admin_roles` ✅

`user_id` (PK, FK to `accounts`), `role` (`admin`, `moderator`), `granted_by`, `created_at`. Users can read only their own row. Writes require the service role. `is_admin()` is the check to use in policies.

### `audit_logs` ✅

Append-only: a trigger rejects every `UPDATE` and `DELETE`, including from the service role.

| Column | Notes |
| --- | --- |
| `id` | uuid PK |
| `actor_id` | uuid, null. **Deliberately not a foreign key**, so history outlives account deletion |
| `action` | e.g. `account.suspended` |
| `target_type`, `target_id` | What was acted upon |
| `metadata` | jsonb |
| `created_at` | |

Admins can read it. Writes require the service role.

### `rate_limit_buckets` ✅

`bucket_key` (PK), `window_start`, `count`. Used only through `check_rate_limit()`, which only the service role can execute. Keys hold SHA-256 hashes, never raw emails or IPs. Stale rows are pruned on about 1% of calls.

Migration: [`supabase/migrations/20261104000000_page_content.sql`](supabase/migrations/20261104000000_page_content.sql)

### New `profiles` columns ✅

| Column | Notes |
| --- | --- |
| `version` | Rises when content changes (name, bio, images, category, theme, indexing). Saves include the version they started from, so a stale tab can't overwrite newer work. Publishing and renaming don't count, because they can't lose anyone's edits |
| `is_indexable` | Whether search engines may list the page |
| `onboarding_completed_at` | Null sends the user to the wizard |
| `username_changed_at` | Limits renames to one a day |

### `blocks` ✅

All page content, including links. Replaces the spec's `links` and `content_blocks`.

| Column | Notes |
| --- | --- |
| `profile_id` | FK, cascade delete. Can't be changed |
| `type` | One of the 18 block types. Can't be changed |
| `config` | jsonb, up to 16 KB. Validated per type by Zod on write and again at render. A `CHECK` rejects any `url` or `linkUrl` that isn't http(s) |
| `position` | Set by trigger on insert, and otherwise only by `reorder_blocks` |
| `is_visible`, `starts_at`, `ends_at` | Visibility and schedule. A `CHECK` requires the end to be after the start |

Limited to 200 per profile by trigger.

**RLS:** owners read their own. Writes also require an active account, through `owns_profile()`.

### `social_links` ✅

`platform` (one of 20), `url` (http, https or mailto only), `position`, `is_visible`. Unique on `(profile_id, platform)`. Same RLS rules as `blocks`.

### `public_blocks` and `public_social_links` views ✅

The only public window onto page content: visible items, on published pages, of active accounts. `public_blocks` also applies the schedule, so hidden, future and expired content never leaves the database.

### `username_history` ✅

Released usernames, held for 30 days for their former owner. Closed to clients.

### `leads` ✅

Newsletter signups and contact-form messages for a page: `kind`, `email`, `name`, `message`, `consent_text`, `consent_at`. Visitors can't insert directly: submissions go through a server action with rate limiting, a spam trap, and a check that the form is really live. Only the page owner can read or delete them. Duplicates are prevented by a unique constraint on `(profile_id, kind, email, message)`.

### `contact_submissions` ✅

Messages from the marketing Contact page. Written by the server, readable only by staff. Until the admin panel exists, read them in Supabase's Table Editor.

### Storage: `profile-media` bucket ✅

Public read, because page images must load for anyone. 5 MB limit; PNG, JPEG, WebP and GIF only, with no SVG since it can carry scripts. Users can upload and delete only inside a folder named after their user ID. The server also checks each file's real type from its first bytes.

Migration: [`supabase/migrations/20261105000000_analytics.sql`](supabase/migrations/20261105000000_analytics.sql). **Not yet applied to the hosted project.**

### `analytics_events`

Raw events, deleted after 30 days. `event_type`, `visitor_hash`, `dedupe_key` (unique) and broad categories: referrer, device, browser, OS, country. **No IP address or user agent is stored.** Closed to all clients, including the page's owner.

### `analytics_daily`

Totals per `(profile_id, day, dimension, dimension_value)`, kept after raw events are gone. Days follow Indian time. Updated in the same transaction as each event. Owners can read their own, and nobody can write except the server.

### `analytics_salts`

One random salt a day, with older ones destroyed. Each visitor hash combines this salt with the page and the visitor's IP and browser string, so the same person looks different on each page and each day, and past hashes can't be recreated.

### New `profiles` column

`analytics_enabled`: a creator's switch to stop counting visits.

## Username rules

3–30 characters; lowercase letters, digits, `_` and `-`; must start and end with a letter or digit; no consecutive separators; not in `reserved_usernames`; not released by someone else in the last 30 days. Enforced in the shared Zod schema and again in the database by a `CHECK` constraint and the `validate_profile_username` trigger. Input is lowercased on write, which is what makes uniqueness case-insensitive.

## Functions

| Function | Callable by | Purpose |
| --- | --- | --- |
| `handle_new_user()` | trigger | Creates the account and, when possible, a draft profile |
| `is_username_available(text)` | anon, authenticated | Availability check; returns a boolean only |
| `record_consent(text, text)` | authenticated | Records consent for the caller with the server's time |
| `is_admin()` | authenticated, service role | Used by policies. True if the caller has any row in `admin_roles` (admin or moderator) |
| `is_valid_username_format(text)` | everyone | Pure format check. Open on purpose, because `CHECK` constraints call it as the current user |
| `is_active_account()` | authenticated, service role | Used by write policies, so suspended accounts can't write |
| `owns_profile(uuid)` | authenticated, service role | True when the caller may change this profile's content |
| `reorder_blocks(uuid, uuid[])`, `reorder_social_links(uuid, uuid[])` | authenticated | All or nothing. A partial, duplicate or foreign list is rejected |
| `record_analytics_event(...)` | service role | Records an event if the page is live and analytics is on. Ignores duplicates: a view within 30 minutes, a click within a minute |
| `purge_expired_analytics()` | service role | Deletes raw events past 30 days, in batches. Runs on about 1% of events, so no scheduler is needed |
| `admin_overview()` | service role | Platform figures. The server checks the caller's admin role first |
| `check_rate_limit(text, int, int)` | service role | Atomic fixed-window counter. Returns `allowed` and `retry_after_seconds` |

All `SECURITY DEFINER` functions set an empty `search_path` and use fully qualified names, and default `PUBLIC` execute rights are revoked.

## Planned tables

| Table | Phase | Purpose | Replaces in the spec |
| --- | --- | --- | --- |
| `theme_presets` 🗓️ | 6 | Admin-editable theme documents. Presets are in code (`src/features/themes/presets.ts`) until something needs to edit them | `profile_themes` |
| `custom_domains` 🗓️ | 6 | Hostname (unique), verification token, status | |
| `reports` 🗓️ | 6 | Abuse reports for profiles and links | |
| `moderation_actions` 🗓️ | 6 | Decisions and reasons | |
| `notifications` 🗓️ | 6 | In-app messages, only if a feature needs them | |

**Spec entities intentionally merged:** `profile_settings` becomes columns and `theme` on `profiles`; the rest are shown in the table above.

## Deletion rules

Deleting a user cascades: `auth.users` → `accounts` → `profiles` → page content. `audit_logs` is retained without a foreign key. From Phase 5, invoices will be retained as long as the law requires and detached from the account rather than deleted; the exact retention rule needs legal input.
