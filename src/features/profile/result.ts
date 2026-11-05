/** What editor actions return. Plain data, so that client components can act on it directly. */
export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code?: "conflict" | "rate_limited" | "invalid"; message: string; fieldErrors?: Record<string, string> };

export const SAVE_FAILED = "We couldn't save that. Please try again.";
export const OFFLINE_MESSAGE = "We couldn't reach the server, so that wasn't saved. Please check your connection and try again.";

/**
 * Runs a server action from the browser. A dropped connection makes the call throw, and without
 * this the screen would just stop responding with no explanation.
 */
export async function safely<T>(action: () => Promise<T>): Promise<T | { ok: false; message: string; code?: undefined; fieldErrors?: undefined }> {
  try {
    return await action();
  } catch {
    return { ok: false, message: OFFLINE_MESSAGE };
  }
}

export function failure(message: string = SAVE_FAILED, fieldErrors?: Record<string, string>): { ok: false; message: string; fieldErrors?: Record<string, string> } {
  return { ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}
