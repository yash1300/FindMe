/**
 * Must match the seeds in supabase/migrations, and include
 * every top-level route. tests/unit/usernames-sync.test.ts enforces both, so adding a
 * route without reserving its name (in a new migration) fails the build's tests.
 */
export const RESERVED_USERNAMES = [
  // Current and planned application routes
  "about", "account", "accounts", "admin", "api", "app", "auth", "billing", "blog", "callback",
  "contact", "dashboard", "docs", "examples", "faq", "features", "forgot-password", "help",
  "home", "integrations", "l", "login", "logout", "manifest", "onboarding", "pricing", "privacy",
  "register", "report", "reset-password", "robots", "settings", "signin", "signout", "signup", "sitemap",
  "static", "status", "support", "suspended", "terms", "themes", "verify-email", "www",
  // Brand and trust-sensitive names
  "abuse", "administrator", "billing-support", "findme", "find-me", "findme-official",
  "findme-support", "helpdesk", "info", "legal", "moderator", "official", "owner", "postmaster",
  "root", "security", "staff", "system", "team", "verified", "webmaster",
] as const;

export const PROHIBITED_USERNAMES = [
  "asshole", "bastard", "bitch", "cunt", "fuck", "hitler", "nazi", "nigger", "porn", "rape",
  "shit", "slut", "whore",
] as const;

const BLOCKED: ReadonlySet<string> = new Set([...RESERVED_USERNAMES, ...PROHIBITED_USERNAMES]);

export function isBlockedUsername(username: string): boolean {
  return BLOCKED.has(username);
}
