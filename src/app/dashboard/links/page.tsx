import type { Metadata } from "next";
import { requireOnboardedUser } from "@/features/auth/session";
import { BlockManager } from "@/features/blocks/components/block-manager";
import { getOwnerContent } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Links" };

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { profile } = await requireOnboardedUser("/dashboard/links");
  const { add } = await searchParams;
  const { blocks, socialLinks } = await getOwnerContent(profile.id);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Links</h1>
        <p className="text-sm text-muted-foreground">Everything on your page. Drag to reorder.</p>
      </div>
      <BlockManager profile={profile} initialBlocks={blocks} socialLinks={socialLinks} startAdding={add === "1"} />
    </div>
  );
}
