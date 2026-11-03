import "server-only";

import { createClient } from "@supabase/supabase-js";
import { ConfigurationError, getPublicEnv } from "@/lib/env";

/**
 * BYPASSES ROW LEVEL SECURITY. Use only for operations no user session can perform,
 * and check authorisation yourself first. Prefer createSupabaseServerClient.
 */
export function createSupabaseAdminClient() {
  const env = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new ConfigurationError("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
