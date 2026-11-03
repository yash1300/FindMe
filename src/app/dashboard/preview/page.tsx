import type { Metadata } from "next";
import { requireOnboardedUser } from "@/features/auth/session";
import { PreviewFrame } from "@/features/profile/components/preview-frame";
import { getOwnerContent } from "@/features/profile/queries";
import { toViewData } from "@/features/profile/to-view-data";

export const metadata: Metadata = { title: "Preview" };

/** The owner's view of their page, whatever its status. Never counted as public traffic. */
export default async function PreviewPage() {
  const { profile } = await requireOnboardedUser("/dashboard/preview");
  const { blocks, socialLinks } = await getOwnerContent(profile.id);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Preview</h1>
        <p className="text-sm text-muted-foreground">Only you can see this view. Links and forms don&apos;t work here.</p>
      </div>
      <PreviewFrame data={toViewData(profile, blocks, socialLinks)} />
    </div>
  );
}
