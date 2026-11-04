import "server-only";

import { logger } from "@/lib/logger";

export type HostingResult = "connected" | "not_configured" | "failed";

function config() {
  const token = process.env.VERCEL_API_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;
  const team = process.env.VERCEL_TEAM_ID;
  return { token, project, query: team ? `?teamId=${encodeURIComponent(team)}` : "" };
}

/** Attaches a verified domain to the Vercel project, which is what serves it and issues its HTTPS certificate. */
export async function addDomainToHosting(hostname: string): Promise<HostingResult> {
  const vercel = config();
  if (!vercel) return "not_configured";
  try {
    const response = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(vercel.project)}/domains${vercel.query}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vercel.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: hostname }),
      signal: AbortSignal.timeout(10_000),
    });
    // 409 means it's already attached, which is the state we want.
    if (response.ok || response.status === 409) return "connected";
    logger.error("domains.vercel_add_failed", { status: response.status });
    return "failed";
  } catch (error) {
    logger.error("domains.vercel_add_failed", { error });
    return "failed";
  }
}

export async function removeDomainFromHosting(hostname: string): Promise<void> {
  const vercel = config();
  if (!vercel) return;
  try {
    const response = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(vercel.project)}/domains/${encodeURIComponent(hostname)}${vercel.query}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${vercel.token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 404) logger.error("domains.vercel_remove_failed", { status: response.status });
  } catch (error) {
    logger.error("domains.vercel_remove_failed", { error });
  }
}
