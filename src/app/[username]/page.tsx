import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ViewBeacon } from "@/features/analytics/components/view-beacon";
import { publicMediaUrl } from "@/features/media/paths";
import { ProfileView } from "@/features/profile/components/profile-view";
import { getPublicProfile } from "@/features/profile/queries";
import { usernameSchema } from "@/features/usernames/schema";
import { getAppUrl } from "@/lib/env";

type Props = { params: Promise<{ username: string }> };

// This route answers with real 404 and redirect statuses, so it waits for its (cached) data
// rather than streaming a shell that would commit to a 200 first.
export const instant = false;

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return "";
  }
}

async function loadProfile(rawUsername: string) {
  const parsed = usernameSchema.safeParse(decodeSegment(rawUsername));
  return parsed.success ? getPublicProfile(parsed.data) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) return { title: "Page not found", robots: { index: false, follow: false } };

  const title = `${profile.displayName} (@${profile.username})`;
  const description = profile.bio?.slice(0, 160) || `Find ${profile.displayName} and everything they do, in one link.`;
  const url = `${getAppUrl()}/${profile.username}`;
  const image = publicMediaUrl(profile.coverPath) ?? publicMediaUrl(profile.avatarPath);

  return {
    title: { absolute: `${title} | FindMe` },
    description,
    alternates: { canonical: url },
    robots: profile.isIndexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url,
      type: "profile",
      siteName: "FindMe",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const decoded = decodeSegment(username);

  // One address per page. /Asha goes to /asha rather than counting as a separate URL.
  const lowered = decoded.toLowerCase();
  if (decoded !== lowered && usernameSchema.safeParse(lowered).success) {
    permanentRedirect(`/${lowered}`);
  }

  const profile = await loadProfile(username);
  if (!profile) notFound();

  return (
    <>
      <ProfileView data={profile} />
      <ViewBeacon profileId={profile.id} />
    </>
  );
}
