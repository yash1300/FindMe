import type { Metadata } from "next";
import { requireOnboardedUser } from "@/features/auth/session";
import { getOwnerContent } from "@/features/profile/queries";
import { toViewData } from "@/features/profile/to-view-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppearanceEditor } from "@/features/themes/components/appearance-editor";
import { ThemeGallery } from "@/features/themes/components/theme-gallery";
import { getGalleryThemes, getMySharedThemes } from "@/features/themes/gallery-queries";
import { parseTheme } from "@/features/themes/presets";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearancePage({ searchParams }: { searchParams: Promise<{ applied?: string }> }) {
  const applied = (await searchParams).applied === "1";
  const { profile } = await requireOnboardedUser("/dashboard/appearance");
  const [{ blocks, socialLinks }, gallery, mine] = await Promise.all([getOwnerContent(profile.id), getGalleryThemes(), getMySharedThemes()]);
  const theme = parseTheme(profile.theme);
  const viewData = toViewData(profile, blocks, socialLinks, theme);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
      {applied ? (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm">Your page now uses the theme you picked from the gallery. Adjust it below if you like.</p>
      ) : null}
      <AppearanceEditor initialTheme={theme} initialVersion={Number(profile.version)} viewData={viewData} />
      <Card>
        <CardHeader>
          <CardTitle>Theme gallery</CardTitle>
          <CardDescription>Themes shared by FindMe creators, free to use. Share yours too.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeGallery themes={gallery} mine={mine} />
        </CardContent>
      </Card>
    </div>
  );
}
