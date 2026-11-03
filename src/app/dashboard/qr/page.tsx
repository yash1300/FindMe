import type { Metadata } from "next";
import { requireOnboardedUser } from "@/features/auth/session";
import { QrStudio } from "@/features/sharing/components/qr-studio";
import { getAppUrl } from "@/lib/env";

export const metadata: Metadata = { title: "QR Code" };

export default async function QrPage() {
  const { profile } = await requireOnboardedUser("/dashboard/qr");
  const url = `${getAppUrl()}/${profile.username}`;

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">QR code and sharing</h1>
        {profile.status !== "published" ? (
          <p className="text-sm text-muted-foreground">Your page isn&apos;t published yet, so this link won&apos;t work for visitors until it is.</p>
        ) : null}
      </div>
      <QrStudio url={url} title={`${profile.display_name} on FindMe`} username={profile.username} />
    </div>
  );
}
