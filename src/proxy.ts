import { type NextRequest, NextResponse } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];
const SIGNED_OUT_ONLY = ["/login", "/register", "/forgot-password"];

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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

// Deliberately excludes marketing and public profile routes. They need no session,
// and running here would add an auth round trip and block caching.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/suspended",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
