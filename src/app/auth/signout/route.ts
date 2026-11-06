import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { ACTIVE_PROFILE_COOKIE } from "@/features/auth/constants";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Logs out with a plain form post and a full page load, so no cached screen can survive it.
 *
 * This lives outside the routes where proxy.ts renews sessions. Logging out from a dashboard page
 * used to share a response with that renewal, so a fresh session cookie could be set alongside
 * the deletion. And if Supabase can't be reached, its client keeps the session, so the cookies
 * are deleted here regardless.
 */
export async function POST(request: NextRequest) {
  // Another site may not log people out. Compared with the Host the browser used, which is
  // what its Origin header is built from, whatever name the server knows itself by.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameHost = false;
  try {
    sameHost = Boolean(origin && host && new URL(origin).host === host);
  } catch {
    sameHost = false;
  }
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && !sameHost)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // A relative Location, so the browser stays on whichever address it used.
  const response = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  response.headers.set("Cache-Control", "no-store");

  if (isSupabaseConfigured()) {
    const env = getPublicEnv();
    const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // Nothing the client sets here should outlive the logout.
        setAll: () => {},
      },
    });
    // Ends this browser's session on the server too, so a copied cookie stops working.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) logger.warn("auth.signout.failed", { code: error.code, status: error.status });
  }

  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith("sb-") || name === ACTIVE_PROFILE_COOKIE) {
      response.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
  }
  return response;
}
