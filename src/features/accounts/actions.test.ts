import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_STATE } from "@/features/auth/action-state";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/features/legal/versions";

const auth = { signInWithPassword: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() };
const rpc = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const limits = vi.fn();
const getContext = vi.fn();

class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

const user = { id: "user-1", email: "asha@example.com" };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth,
    rpc,
    from: () => ({ insert, update: (...args: unknown[]) => ({ eq: () => update(...args) }) }),
  }),
}));
vi.mock("@/features/auth/session", () => ({
  requireUser: async () => user,
  getAccountContext: (...args: unknown[]) => getContext(...args),
}));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/lib/security/rate-limit")>()),
  checkRateLimits: (...args: unknown[]) => limits(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

const actions = await import("./actions");

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

const consented = { terms_accepted_version: TERMS_VERSION, privacy_accepted_version: PRIVACY_VERSION };
const notConsented = { terms_accepted_version: null, privacy_accepted_version: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  limits.mockResolvedValue({ status: "allowed" });
  rpc.mockResolvedValue({ error: null });
  insert.mockResolvedValue({ error: null });
  update.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});

describe("completeOnboardingAction", () => {
  const googleUser = { account: { status: "active", ...notConsented }, profile: null };
  const valid = { username: "asharao", name: "Asha", consent: "on" };

  it("requires consent from a Google user, even if the form omits the field", async () => {
    getContext.mockResolvedValue(googleUser);
    const result = await actions.completeOnboardingAction(IDLE_STATE, form({ username: "asharao", name: "Asha" }));
    expect(result.fieldErrors?.consent).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records consent, creates the profile for this user only, and continues", async () => {
    getContext.mockResolvedValue(googleUser);
    await expect(actions.completeOnboardingAction(IDLE_STATE, form(valid))).rejects.toMatchObject({ url: "/dashboard" });
    expect(rpc).toHaveBeenCalledWith("record_consent", {
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
    });
    expect(insert).toHaveBeenCalledWith({ owner_id: user.id, username: "asharao", display_name: "Asha" });
  });

  it.each([
    ["lost race", "23505"],
    ["blocked by the database", "23514"],
  ])("shows a username error when the insert fails: %s", async (_label, code) => {
    getContext.mockResolvedValue(googleUser);
    insert.mockResolvedValue({ error: { code } });
    const result = await actions.completeOnboardingAction(IDLE_STATE, form(valid));
    expect(result.fieldErrors?.username).toBe("This username isn't available.");
  });

  it("only asks for new consent when a profile already exists", async () => {
    getContext.mockResolvedValue({ account: { status: "active", ...notConsented }, profile: { id: "p" } });
    await expect(actions.completeOnboardingAction(IDLE_STATE, form({ consent: "on" }))).rejects.toMatchObject({
      url: "/dashboard",
    });
    expect(insert).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("sends suspended accounts away", async () => {
    getContext.mockResolvedValue({ account: { status: "suspended", ...consented }, profile: null });
    await expect(actions.completeOnboardingAction(IDLE_STATE, form(valid))).rejects.toMatchObject({ url: "/suspended" });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("changePasswordAction", () => {
  const valid = { currentPassword: "old password", password: "a brand new password", confirmPassword: "a brand new password" };

  it("rejects a wrong current password and changes nothing", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    const result = await actions.changePasswordAction(IDLE_STATE, form(valid));
    expect(result.fieldErrors?.currentPassword).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("checks against the signed-in user's own email, whatever the form sends", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    await actions.changePasswordAction(IDLE_STATE, form({ ...valid, email: "victim@example.com" }));
    expect(auth.signInWithPassword.mock.calls[0][0].email).toBe(user.email);
  });

  it("signs out other devices after a change", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    const result = await actions.changePasswordAction(IDLE_STATE, form(valid));
    expect(result.status).toBe("success");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("stops at the rate limit before checking the password", async () => {
    limits.mockResolvedValue({ status: "limited", retryAfterSeconds: 60 });
    await actions.changePasswordAction(IDLE_STATE, form(valid));
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("changeEmailAction", () => {
  it("responds the same when the address is already in use", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: null });
    const fresh = await actions.changeEmailAction(IDLE_STATE, form({ email: "new@example.com" }));

    auth.updateUser.mockResolvedValueOnce({ error: { code: "email_exists", status: 422 } });
    const taken = await actions.changeEmailAction(IDLE_STATE, form({ email: "taken@example.com" }));

    expect(taken).toEqual(fresh);
  });
});

describe("updateAccountNameAction", () => {
  it("rejects an empty name", async () => {
    const result = await actions.updateAccountNameAction(IDLE_STATE, form({ name: "   " }));
    expect(result.fieldErrors?.name).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("saves a trimmed name", async () => {
    const result = await actions.updateAccountNameAction(IDLE_STATE, form({ name: "  Asha  " }));
    expect(result.status).toBe("success");
    expect(update).toHaveBeenCalledWith({ display_name: "Asha" });
  });
});
