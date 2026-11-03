import { EMBED_FRAME_ORIGINS } from "../../features/blocks/embeds";

type HeaderOptions = {
  isProduction: boolean;
  supabaseUrl?: string;
};

/**
 * 'unsafe-inline' for scripts is a known, documented trade-off: Next.js injects inline
 * bootstrap scripts, and nonces would force every page to render dynamically, defeating
 * the caching public profiles rely on. See "Known gaps" in SECURITY.md.
 */
export function buildContentSecurityPolicy({ isProduction, supabaseUrl }: HeaderOptions): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const supabaseWs = supabase.replace(/^http/, "ws");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isProduction ? [] : ["'unsafe-eval'"])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(supabase ? [supabase] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(supabase ? [supabase, supabaseWs] : []), ...(isProduction ? [] : ["ws:"])],
    "frame-src": [...EMBED_FRAME_ORIGINS],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // The Google sign-in form redirects through Supabase to Google, and browsers apply this to redirects.
    "form-action": ["'self'", ...(supabase ? [supabase] : []), "https://accounts.google.com"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (isProduction) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function buildSecurityHeaders(options: HeaderOptions): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ];
  if (options.isProduction) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
