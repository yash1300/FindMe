import type { MetadataRoute } from "next";
import { getSitemapProfiles } from "@/features/profile/queries";
import { getAppUrl } from "@/lib/env";

const MARKETING_PATHS = ["", "/features", "/pricing", "/themes", "/about", "/contact", "/faq", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl();
  const profiles = await getSitemapProfiles();
  return [
    ...MARKETING_PATHS.map((path) => ({ url: `${base}${path}` })),
    ...profiles.map((profile) => ({ url: `${base}/${profile.username}`, lastModified: profile.updatedAt })),
  ];
}
