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

## Username rules

3–30 characters; lowercase letters, digits, `_` and `-`; must start and end with a letter or digit; no consecutive separators; not in `reserved_usernames`. Enforced in the shared Zod schema and again in the database by a `CHECK` constraint and the `validate_profile_username` trigger. Input is lowercased on write, which is what makes uniqueness case-insensitive.

## Functions

| Function | Callable by | Purpose |
| --- | --- | --- |
| `handle_new_user()` | trigger | Creates the account and, when possible, a draft profile |
| `is_username_available(text)` | anon, authenticated | Availability check; returns a boolean only |
| `record_consent(text, text)` | authenticated | Records consent for the caller with the server's time |
| `is_admin()` | authenticated, service role | Used by policies. True if the caller has any row in `admin_roles` (admin or moderator) |
| `is_valid_username_format(text)` | everyone | Pure format check. Open on purpose, because `CHECK` constraints call it as the current user |
| `check_rate_limit(text, int, int)` | service role | Atomic fixed-window counter. Returns `allowed` and `retry_after_seconds` |

All `SECURITY DEFINER` functions set an empty `search_path` and use fully qualified names, and default `PUBLIC` execute rights are revoked.

## Planned tables

| Table | Phase | Purpose | Replaces in the spec |
| --- | --- | --- | --- |
| `blocks` 🗓️ | 2 | All page content: `type`, `config` jsonb, `position`, `is_visible`, `starts_at`, `ends_at`. Index on `(profile_id, position)` | `links`, `content_blocks` |
| `social_links` 🗓️ | 2 | `platform`, `url`, `position`, `is_visible`; unique on `(profile_id, platform)` | |
| `theme_presets` 🗓️ | 2 | Named theme documents and the plan they require | `profile_themes` |
| `analytics_events` 🗓️ | 4 | Raw events with category fields and a daily salted visitor hash. **No raw IP.** Retention job | `profile_views`, `link_clicks` |
| `analytics_daily` 🗓️ | 4 | Aggregates unique on `(profile_id, block_id, day, dimension)` | |
| `subscription_plans` 🗓️ | 5 | Prices per currency and interval, limits and entitlements as data | |
| `subscriptions` 🗓️ | 5 | Provider IDs and status. Written only by webhook handlers | |
| `payment_events` 🗓️ | 5 | Raw webhook log, unique on `(provider, event_id)` for idempotency | |
| `invoices` 🗓️ | 5 | Amounts in minor units, tax lines captured at time of sale, refund state | |
| `tax_rules` 🗓️ | 5 | Configurable rates by jurisdiction and date; no tax logic in code | |
| `custom_domains` 🗓️ | 6 | Hostname (unique), verification token, status | |
| `leads` 🗓️ | 6 | Newsletter and contact entries, custom fields, consent text and time | `contact_submissions` |
| `reports` 🗓️ | 6 | Abuse reports for profiles and links | |
| `moderation_actions` 🗓️ | 6 | Decisions and reasons | |
| `notifications` 🗓️ | 6 | In-app messages, only if a feature needs them | |

**Spec entities intentionally merged:** `profile_settings` becomes columns and `theme` on `profiles`; the rest are shown in the table above.

## Deletion rules

Deleting a user cascades: `auth.users` → `accounts` → `profiles` → page content. `audit_logs` is retained without a foreign key. From Phase 5, invoices will be retained as long as the law requires and detached from the account rather than deleted; the exact retention rule needs legal input.
