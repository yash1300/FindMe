import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

/**
 * Refreshes the session cookie and reports whether a user is signed in. Used only to route
 * people to the right page. Pages and actions still authorise themselves, and RLS sits beneath.
 */
export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Fails closed: with no backend configured, nobody is treated as signed in.
  if (!isSupabaseConfigured()) return { response, isSignedIn: false };

  const env = getPublicEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  return { response, isSignedIn: !error && Boolean(data?.claims) };
}
