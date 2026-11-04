import { type NextRequest, NextResponse } from "next/server";
import { isAppHost } from "@/features/domains/host";
import { getAppUrl, getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import { refreshSession } from "@/lib/supabase/proxy";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/admin"];
const SIGNED_OUT_ONLY = ["/login", "/register", "/forgot-password"];
const SESSION_PREFIXES = [...PROTECTED_PREFIXES, ...SIGNED_OUT_ONLY, "/suspended", "/reset-password"];

// What a custom domain may serve besides the page itself.
const CUSTOM_DOMAIN_PASSTHROUGH = ["/l", "/api/events", "/report", "/icon.svg"];

const DOMAIN_CACHE_MS = 60_000;
const DOMAIN_CACHE_MAX = 1000;
const domainCache = new Map<string, { username: string | null; expires: number }>();

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** A short cache, because this runs on every request to a custom domain. Failures aren't cached. */
async function resolveDomain(hostname: string): Promise<string | null> {
  const cached = domainCache.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.username;
  if (!isSupabaseConfigured()) return null;

  const env = getPublicEnv();
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/resolve_custom_domain`, {
    method: "POST",
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_hostname: hostname }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => null);
  if (!response?.ok) return null;

  const username = (await response.json()) as string | null;
  if (domainCache.size >= DOMAIN_CACHE_MAX) domainCache.clear();
  domainCache.set(hostname, { username, expires: Date.now() + DOMAIN_CACHE_MS });
  return username;
}

async function handleCustomDomain(request: NextRequest, hostname: string) {
  const { pathname } = request.nextUrl;
  if (matchesPrefix(pathname, CUSTOM_DOMAIN_PASSTHROUGH) || request.method !== "GET") return NextResponse.next();

  if (pathname === "/") {
    const username = await resolveDomain(hostname);
    // A name that can't exist, so the page route answers with a real 404.
    return NextResponse.rewrite(new URL(username ? `/${username}` : "/__unknown_domain", request.url));
  }

  // Anything else belongs on the main site. Sign-in in particular must never happen on a creator's domain.
  return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, getAppUrl()), 308);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hostname = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  if (hostname && !isAppHost(hostname, getAppUrl())) return handleCustomDomain(request, hostname);

  // Marketing and public pages need no session, so they get no auth round trip and stay cacheable.
  if (!matchesPrefix(pathname, SESSION_PREFIXES)) return NextResponse.next();

  const { response, isSignedIn } = await refreshSession(request);

  let destination: URL | null = null;
  if (!isSignedIn && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    destination = new URL("/login", request.url);
    destination.searchParams.set("next", `${pathname}${search}`);
  } else if (isSignedIn && matchesPrefix(pathname, SIGNED_OUT_ONLY)) {
    destination = new URL("/dashboard", request.url);
  }

  if (!destination) return response;

  // A refreshed session must survive the redirect, or the user is signed out on their next request.
  const redirect = NextResponse.redirect(destination);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
