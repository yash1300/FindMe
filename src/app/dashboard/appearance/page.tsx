import type { Metadata } from "next";
import { requireOnboardedUser } from "@/features/auth/session";
import { getOwnerContent } from "@/features/profile/queries";
import { toViewData } from "@/features/profile/to-view-data";
import { AppearanceEditor } from "@/features/themes/components/appearance-editor";
import { parseTheme } from "@/features/themes/presets";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearancePage() {
  const { profile } = await requireOnboardedUser("/dashboard/appearance");
  const { blocks, socialLinks } = await getOwnerContent(profile.id);
  const theme = parseTheme(profile.theme);
  const viewData = toViewData(profile, blocks, socialLinks, theme);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
      <AppearanceEditor initialTheme={theme} initialVersion={Number(profile.version)} viewData={viewData} />
    </div>
  );
}
