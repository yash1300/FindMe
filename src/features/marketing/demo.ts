import type { ProfileViewData } from "@/features/profile/components/profile-view";
import { THEME_PRESETS } from "@/features/themes/presets";
import type { Theme } from "@/features/themes/schema";

/** A clearly fictional sample for showing what themes look like. It isn't a real person or customer. */
export function demoProfile(theme: Theme = THEME_PRESETS.modern): ProfileViewData {
  return {
    username: "yourname",
    displayName: "Your Name",
    bio: "Everything you are, in one link.",
    avatarPath: null,
    coverPath: null,
    theme,
    socialLinks: [
      { id: "s1", platform: "instagram", url: "https://instagram.com" },
      { id: "s2", platform: "youtube", url: "https://youtube.com" },
      { id: "s3", platform: "spotify", url: "https://open.spotify.com" },
    ],
    blocks: [
      { id: "b0", type: "social_icons", config: {} },
      { id: "b1", type: "link", config: { title: "My latest video", url: "https://example.com/", icon: "video" } },
      { id: "b2", type: "link", config: { title: "Book a session", url: "https://example.com/", icon: "calendar" } },
      { id: "b3", type: "link", config: { title: "Visit my shop", url: "https://example.com/", icon: "shopping-bag" } },
    ],
  };
}
