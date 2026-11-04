# FindMe — Architecture

## 1. System overview

```text
                 ┌───────────────── Vercel ─────────────────┐
 Browser ──────► │ proxy.ts  session refresh, route guard   │
                 │    │      (later: custom-domain rewrite)  │
                 │    ▼                                      │
                 │ Next.js App Router                        │
                 │  (marketing)  cached, static              │
                 │  (auth)       server actions              │──► Supabase Auth
                 │  dashboard    dynamic, per user           │──► Supabase Postgres (RLS)
                 │  admin        dynamic, role-checked       │──► Supabase Storage
                 │  [username]   cached, invalidated on edit │
                 │  api/*        webhooks, events, health    │
                 └──────────────┬────────────────────────────┘
                                ├──► Razorpay (Phase 5)
                                └──► Resend   (Phase 2+)
```

## 2. Key decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Authorisation boundary | **Postgres RLS is the final authority**; server code checks too | The anon key is public, so any rule only in TypeScript can be bypassed by calling PostgREST directly |
| Default data client | The user's session client, not service role | A bug then fails closed, because RLS still applies |
| Service-role use | Only in `src/lib/supabase/admin.ts`, guarded by `server-only` | Keeps the privileged surface small and easy to audit |
| Validation | Zod schemas shared by client and server, and DB `CHECK` constraints for critical invariants | Forms get instant feedback, and direct API calls cannot break invariants |
| Links and blocks | One `blocks` table with a `type` and a validated JSON `config` | Reordering, visibility and scheduling behave the same for every block; avoids two parallel tables |
| Output safety | Values are re-validated at render, including URLs. No `dangerouslySetInnerHTML` for user content | Defence in depth against rows written before a rule tightened |
| Rate limiting | Postgres-backed fixed window | No new vendor or cost; can move to Redis behind the same interface if load requires it |
| Domains | Canonical origin from env, never a literal | Dev, staging and custom domains all work the same way |
| Analytics identity | Salted, daily-rotating hash of IP + user agent; raw IP is never stored | Gives estimated uniques without a persistent identifier |
| Profile page tracking | Client beacon after render, not in the page handler | Lets pages be cached while still counting views |

## 3. Directory layout

```text
src/
  app/
    (marketing)/          public site, legal pages
    (auth)/               login, register, forgot/reset password, verify email
    auth/callback/        OAuth and email-link exchange
    onboarding/           post-signup wizard
    dashboard/            creator dashboard (protected)
    admin/                admin panel, Phase 6 (role-protected)
    [username]/           public profile, Phase 2
    api/                  route handlers
  components/
    ui/                   shadcn/ui primitives
  features/               one folder per domain, each owning its actions/services/components
    auth/  usernames/  accounts/  legal/  (later: links, blocks, themes, analytics, billing, admin)
  lib/
    supabase/             server, proxy and admin clients (a browser client arrives when a feature needs one)
    env.ts                validated configuration
    security/             safe redirects, rate limiting, client IP
    logger.ts             structured logs
supabase/
  migrations/             the only way the schema changes
  config.toml             local stack configuration
tests/
  db/                     migration and RLS tests (PGlite)
  unit/                   repo-wide guards: reserved names, secret boundaries
  e2e/                    Playwright, including direct PostgREST attacks on the real stack
```

Unit and component tests sit beside the code they cover as `*.test.ts(x)`.

**Dependency rule:** `app/` imports from `features/` and `lib/`. `features/` may import from `lib/` and `components/`, and from other features only through a deliberately exported function. `lib/` imports from neither.

## 4. Request flows

### Registration

1. The username field validates with the shared Zod schema and checks availability (debounced). Other fields are validated on submit.
2. A server action re-validates, rate-limits by IP, and calls `supabase.auth.signUp` with `username`, `display_name` and consent versions in metadata.
3. The DB trigger `handle_new_user` creates the `accounts` row and tries to create a draft profile.
   - If the username was taken in the meantime, the trigger skips the profile rather than failing the signup, and onboarding asks for a new name.
4. The user follows the email link to `/auth/callback`, which exchanges it for a session. They continue to onboarding, then the dashboard.

Google sign-ups carry no username or consent, so onboarding collects both. A user cannot reach the dashboard without them.

### Route protection

`src/proxy.ts` refreshes the session and sends signed-out users away from protected paths. **This is a convenience, not the security boundary:** every protected page and action checks for itself through `requireUser()` or `requireOnboardedUser()`, and RLS sits underneath. The proxy runs only on auth and dashboard routes, so marketing and public profile pages stay free of auth round trips and cookies.

### Rendering with Cache Components

`cacheComponents` and `partialPrefetching` are on. Pages prerender a static shell holding no user data, and session-dependent content streams in behind `<Suspense>`. Sessions are deliberately not cached with `use cache: private`, so a suspension takes effect on the next request. `getCurrentUser` awaits `connection()` first, which keeps it out of prerendering and prefetch passes.

### Public profile

`/[username]` lowercases and validates the name, then reads from the `public_*` views as an anonymous visitor, so private data can't reach it. The result is cached with `use cache`, tagged per profile, and invalidated by every edit; a 60-second lifetime covers scheduled links starting or ending, which no edit triggers. Interactive parts such as contact forms and video players are small client islands.

`ProfileView` is the one renderer behind public pages, the editor's live preview and the marketing demos, so what creators see is what visitors get.

`htmlLimitedBots: /.*/` in `next.config.ts` makes metadata block rather than stream. Without it, the response commits to a 200 before the page can answer 404.

### Editing

Blocks and social links update optimistically and roll back if the server refuses. The appearance editor keeps an undo history in the browser and autosaves after a short pause. Saves run one at a time, each carrying the version from the last, so a change made elsewhere is reported as a conflict instead of being overwritten.

### Analytics

Public pages stay cached, and a small client component reports each view to `/api/events` after loading. Clicks go through `/l/{blockId}`, which looks up the block server-side and redirects only to the stored URL after re-validating it. No URL ever comes from the request, so an open redirect is structurally impossible. Both record after responding, using `after()`, so analytics never slows a visitor down or breaks a link.

Previews never send events, so they can't count as traffic. A creator's own visits to their public page do count, because telling them apart would need a session lookup on every view.

### Payments

Not built: FindMe is free for everyone. See PROJECT_PLAN.md.

## 5. Theming

A profile stores a validated `theme` JSON document. The renderer maps it to CSS custom properties on the page root, so themes need no per-theme JavaScript and add almost nothing to page weight. Colours, gradients and fonts come from validated values; **free-form CSS is never accepted**.

Presets live in `src/features/themes/presets.ts`. Card and field corners have their own capped radii, because a tall element given the 9999px pill radius becomes an ellipse and clips its contents.

The dashboard uses fixed brand tokens: Midnight `#111827`, White `#FFFFFF`, Electric Violet `#7657F6`, Mint `#20C997`, Soft Grey `#F3F4F6`. Public profile themes are not limited to them.

## 6. Configuration and environments

| Environment | App | Database |
| --- | --- | --- |
| Local | `npm run dev` | `supabase start` (needs Docker) |
| Automated DB tests | — | PGlite, in-process, no Docker |
| Preview / staging | Vercel preview | Separate Supabase project |
| Production | Vercel production | Production Supabase project |

All configuration is validated by `src/lib/env.ts`. See [DEPLOYMENT.md](DEPLOYMENT.md) for the variables.

## 7. Observability

- **Now:** structured JSON logs from `src/lib/logger.ts`, with secret-looking fields redacted. `/api/health` reports liveness and DB reachability.
- **Before launch:** an error monitoring service. Choosing one is a cost decision, so it needs approval; Vercel Web Analytics or the `web-vitals` API can report Core Web Vitals.

## 8. Known trade-offs

- **CSP allows inline scripts.** Nonce-based CSP forces dynamic rendering of every page, which conflicts with caching public profiles. We ship a restrictive CSP with `'unsafe-inline'` for scripts now and rely on React escaping and the ban on raw user HTML as the main XSS controls. To be revisited in the Phase 8 audit; see [SECURITY.md](SECURITY.md).
- **Auth calls come from the server.** Server actions let us validate and rate-limit, but Supabase then sees Vercel's IP rather than the user's, so its per-IP limits must be raised and our limiter becomes the one that matters. See [DEPLOYMENT.md](DEPLOYMENT.md).
- **Postgres rate limiting** adds a DB round trip per limited request. This is acceptable because only auth and form endpoints are limited; analytics ingestion will need its own approach in Phase 4.
- **Dashboard links don't prefetch.** Those pages are per-user and dynamic, so it would gain little, and each save would otherwise re-prefetch every link with its own auth round trip.
- **Unverified accounts can hold usernames.** A cleanup job for long-unverified accounts is planned for Phase 6.
- **PGlite is not Supabase.** Database tests run as a superuser against stubbed roles, and PGlite's Postgres version can differ from production. The E2E suite covers the gap by attacking real PostgREST.
