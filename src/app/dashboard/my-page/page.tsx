import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/features/auth/session";
import { ProfileDetailsForm, PublishControls, UsernameForm } from "@/features/profile/components/my-page-forms";
import { getOwnerContent } from "@/features/profile/queries";
import { SocialManager } from "@/features/social/components/social-manager";
import { getAppUrl } from "@/lib/env";

export const metadata: Metadata = { title: "My Page" };

export default async function MyPagePage() {
  const { profile } = await requireOnboardedUser("/dashboard/my-page");
  const { socialLinks } = await getOwnerContent(profile.id);
  const baseUrl = getAppUrl();

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">My Page</h1>

      <Card>
        <CardHeader>
          <CardTitle>Publishing</CardTitle>
        </CardHeader>
        <CardContent>
          <PublishControls initialStatus={profile.status} username={profile.username} baseUrl={baseUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>What visitors see at the top of your page.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileDetailsForm
            initial={{
              displayName: profile.display_name,
              bio: profile.bio,
              category: profile.category,
              avatarPath: profile.avatar_path,
              coverPath: profile.cover_path,
              isIndexable: profile.is_indexable,
              analyticsEnabled: profile.analytics_enabled,
              version: Number(profile.version),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social links</CardTitle>
          <CardDescription>Drag to reorder. Hide a link to keep it without showing it.</CardDescription>
        </CardHeader>
        <CardContent>
          <SocialManager initialLinks={socialLinks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Username</CardTitle>
        </CardHeader>
        <CardContent>
          <UsernameForm username={profile.username} baseUrl={baseUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
