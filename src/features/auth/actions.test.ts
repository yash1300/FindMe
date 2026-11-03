import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_STATE } from "./action-state";
import { RECOVERY_COOKIE } from "./constants";

const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};
const rpc = vi.fn();
const limits = vi.fn();
const cookieGet = vi.fn();
const cookieDelete = vi.fn();

class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth, rpc }),
}));
vi.mock("@/lib/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/lib/security/rate-limit")>()),
  checkRateLimits: (...args: unknown[]) => limits(...args),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => ({ get: cookieGet, delete: cookieDelete }),
}));
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

const registration = {
  name: "Asha Rao",
  email: "asha@example.com",
  password: "correct horse battery",
  username: "asharao",
  consent: "on",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  limits.mockResolvedValue({ status: "allowed" });
  rpc.mockResolvedValue({ data: true, error: null });
});

describe("registerAction", () => {
  it("rejects invalid input without calling Supabase", async () => {
    const result = await actions.registerAction(IDLE_STATE, form({ ...registration, email: "nope", consent: "" }));
    expect(result.status).toBe("error");
    expect(result.fieldErrors).toHaveProperty("email");
    expect(result.fieldErrors).toHaveProperty("consent");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("never echoes the password back", async () => {
    const result = await actions.registerAction(IDLE_STATE, form({ ...registration, email: "nope" }));
    expect(JSON.stringify(result)).not.toContain(registration.password);
  });

  it("records consent versions and sends users to the app's own callback", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await actions.registerAction(IDLE_STATE, form(registration));
    expect(result).toEqual({ status: "success", code: "check_email", email: registration.email });

    const options = auth.signUp.mock.calls[0][0].options;
    expect(options.emailRedirectTo).toBe("https://app.example.test/auth/callback");
    expect(options.data.username).toBe("asharao");
    expect(options.data.terms_version).toBeTruthy();
    expect(options.data.privacy_version).toBeTruthy();
  });

  it("responds the same when the email is already registered", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    const fresh = await actions.registerAction(IDLE_STATE, form(registration));

    auth.signUp.mockResolvedValueOnce({ data: {}, error: { code: "user_already_exists", status: 422 } });
    const existing = await actions.registerAction(IDLE_STATE, form(registration));

    expect(existing).toEqual(fresh);
  });

  it("rejects a taken username before signing up", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await actions.registerAction(IDLE_STATE, form(registration));
    expect(result.fieldErrors?.username).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("stops at the rate limit", async () => {
    limits.mockResolvedValue({ status: "limited", retryAfterSeconds: 120 });
    const result = await actions.registerAction(IDLE_STATE, form(registration));
    expect(result.message).toMatch(/2 minutes/);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("fails closed when the rate limiter is unavailable", async () => {
    limits.mockResolvedValue({ status: "unavailable" });
    const result = await actions.registerAction(IDLE_STATE, form(registration));
    expect(result.status).toBe("error");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("fails safely when Supabase isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const result = await actions.registerAction(IDLE_STATE, form(registration));
    expect(result.status).toBe("error");
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe("loginAction", () => {
  const credentials = { email: "asha@example.com", password: "correct horse battery" };

  it("redirects to a safe next path", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(
      actions.loginAction(IDLE_STATE, form({ ...credentials, next: "/dashboard/settings" })),
    ).rejects.toMatchObject({ url: "/dashboard/settings" });
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example"])(
    "ignores the open redirect attempt %s",
    async (next) => {
      auth.signInWithPassword.mockResolvedValue({ error: null });
      await expect(actions.loginAction(IDLE_STATE, form({ ...credentials, next }))).rejects.toMatchObject({
        url: "/dashboard",
      });
    },
  );

  it("gives one generic message for bad credentials", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    const result = await actions.loginAction(IDLE_STATE, form(credentials));
    expect(result.message).toBe("Incorrect email or password.");
    expect(JSON.stringify(result)).not.toContain(credentials.password);
  });

  it("offers a new link for an unconfirmed email", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed", status: 400 } });
    const result = await actions.loginAction(IDLE_STATE, form(credentials));
    expect(result.code).toBe("email_not_confirmed");
  });

  it("limits by both IP and email, hashing the identifiers", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    await actions.loginAction(IDLE_STATE, form(credentials));
    const checks = limits.mock.calls[0][0] as [string, unknown][];
    expect(checks).toHaveLength(2);
    const keys = checks.map(([key]) => key).join(" ");
    expect(keys).toContain("login:ip:");
    expect(keys).toContain("login:email:");
    expect(keys).not.toContain("asha");
    expect(keys).not.toContain("203.0.113.9");
  });

  it("does not attempt sign-in once limited", async () => {
    limits.mockResolvedValue({ status: "limited", retryAfterSeconds: 60 });
    await actions.loginAction(IDLE_STATE, form(credentials));
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("requestPasswordResetAction", () => {
  it("responds the same whether or not the send succeeds", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const ok = await actions.requestPasswordResetAction(IDLE_STATE, form({ email: "a@example.com" }));

    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code: "user_not_found", status: 404 } });
    const failed = await actions.requestPasswordResetAction(IDLE_STATE, form({ email: "a@example.com" }));

    expect(failed).toEqual(ok);
    expect(ok.status).toBe("success");
  });
});

describe("resendVerificationAction", () => {
  it("responds the same whether or not the send succeeds", async () => {
    auth.resend.mockResolvedValueOnce({ error: null });
    const ok = await actions.resendVerificationAction(IDLE_STATE, form({ email: "a@example.com" }));

    auth.resend.mockResolvedValueOnce({ error: { code: "unexpected", status: 500 } });
    const failed = await actions.resendVerificationAction(IDLE_STATE, form({ email: "a@example.com" }));

    expect(failed).toEqual(ok);
  });
});

describe("resetPasswordAction", () => {
  const passwords = { password: "a brand new password", confirmPassword: "a brand new password" };
  const user = { id: "user-1" };

  it("refuses a signed-in user who did not arrive through a recovery link", async () => {
    auth.getUser.mockResolvedValue({ data: { user } });
    cookieGet.mockReturnValue(undefined);
    const result = await actions.resetPasswordAction(IDLE_STATE, form(passwords));
    expect(result.status).toBe("error");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("refuses a recovery marker that belongs to a different user", async () => {
    auth.getUser.mockResolvedValue({ data: { user } });
    cookieGet.mockReturnValue({ value: "someone-else" });
    await actions.resetPasswordAction(IDLE_STATE, form(passwords));
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password, clears the marker, and signs out other sessions", async () => {
    auth.getUser.mockResolvedValue({ data: { user } });
    cookieGet.mockReturnValue({ value: user.id });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });

    await expect(actions.resetPasswordAction(IDLE_STATE, form(passwords))).rejects.toMatchObject({ url: "/dashboard" });
    expect(cookieDelete).toHaveBeenCalledWith(RECOVERY_COOKIE);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });
});
