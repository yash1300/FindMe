import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/onboarding", "/suspended", "/api/", "/auth/", "/reset-password"],
    },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
