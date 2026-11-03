/** What editor actions return. Plain data, so that client components can act on it directly. */
export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code?: "conflict" | "rate_limited" | "invalid"; message: string; fieldErrors?: Record<string, string> };

export const SAVE_FAILED = "We couldn't save that. Please try again.";

export function failure(message: string = SAVE_FAILED, fieldErrors?: Record<string, string>): { ok: false; message: string; fieldErrors?: Record<string, string> } {
  return { ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}
