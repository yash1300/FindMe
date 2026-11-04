import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/onboarding", "/admin", "/suspended", "/api/", "/auth/", "/l/", "/report", "/reset-password"],
    },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
