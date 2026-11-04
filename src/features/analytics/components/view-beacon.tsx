"use client";

import { useEffect } from "react";

/** Reports one page view. It's only rendered on real public pages, never in previews. */
export function ViewBeacon({ profileId }: { profileId: string }) {
  useEffect(() => {
    const body = JSON.stringify({ profileId, referrer: document.referrer || undefined });
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [profileId]);

  return null;
}
