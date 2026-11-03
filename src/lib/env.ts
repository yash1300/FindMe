import { z } from "zod";

/**
 * Public configuration. NEXT_PUBLIC_* values are inlined at build time, so each must be
 * referenced by its full name here. Validation is lazy so that `next build` and pages that
 * need no backend still work before credentials exist; anything that does need them fails
 * closed with ConfigurationError.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().transform((value) => value.replace(/\/+$/, "")),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function getPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new ConfigurationError(`Missing or invalid environment variables: ${names}`);
  }
  return parsed.data;
}

export function isSupabaseConfigured(): boolean {
  try {
    getPublicEnv();
    return true;
  } catch {
    return false;
  }
}

/** The canonical origin. Falls back for metadata only, never for security decisions. */
export function getAppUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  const parsed = z.url().safeParse(value);
  return parsed.success ? parsed.data.replace(/\/+$/, "") : "http://localhost:3000";
}

export function isGoogleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}

export function getSupportEmail(): string | null {
  const parsed = z.email().safeParse(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
  return parsed.success ? parsed.data : null;
}
