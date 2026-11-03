import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/headers";

function supabaseImagePattern() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return [];
  const url = new URL(value);
  return [
    {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: "/storage/v1/object/public/**",
    },
  ];
}

const isLocalSupabase = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Send metadata in <head> for everyone. Streaming it would commit a 200 status before a
  // public profile can answer 404, and it costs little here because that metadata is cached.
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [
      ...supabaseImagePattern(),
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
    ],
    // Only ever on for the local stack, whose address is private. Off everywhere else.
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  experimental: {
    // Slightly above the 5 MB image limit, to leave room for form encoding.
    serverActions: { bodySizeLimit: "6mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          isProduction: process.env.NODE_ENV === "production",
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        }),
      },
    ];
  },
};

export default nextConfig;
