import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * Needs the local Supabase stack (`npx supabase start`) and a production build whose
 * NEXT_PUBLIC_* values point at it, because those are fixed at build time.
 * Run `npm run build` first; see DEPLOYMENT.md.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Flows share one rate limiter and Mailpit inbox, so they run one after another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3000",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
