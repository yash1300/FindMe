import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { blockDestination } from "@/features/blocks/destination";
import { getPublicProfile } from "@/features/profile/queries";
import { ReportForm } from "@/features/reports/components/report-form";
import { usernameSchema } from "@/features/usernames/schema";

export const metadata: Metadata = { title: "Report a page", robots: { index: false, follow: false } };

async function ReportContent({ searchParams }: { searchParams: Promise<{ u?: string | string[] }> }) {
  const { u } = await searchParams;
  const parsed = usernameSchema.safeParse(typeof u === "string" ? u : "");
  const profile = parsed.success ? await getPublicProfile(parsed.data) : null;
  if (!profile) return <p className="text-muted-foreground">We couldn&apos;t find that page. Open the page you&apos;d like to report, then use the Report link at the bottom of it.</p>;

  const links = profile.blocks.flatMap((block) => {
    if (!blockDestination(block)) return [];
    const { config } = block as { config: { title?: string; text?: string; alt?: string } };
    return [{ id: block.id, title: (config.title ?? config.text ?? config.alt ?? "Link").slice(0, 80) }];
  });

  return (
    <>
      <p className="text-muted-foreground">You&apos;re reporting <span className="font-medium text-foreground">@{profile.username}</span>. We review reports and act on anything that breaks our Terms.</p>
      <ReportForm username={profile.username} links={links} />
    </>
  );
}

export default function ReportPage({ searchParams }: { searchParams: Promise<{ u?: string | string[] }> }) {
  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Report a page</h1>
      <Suspense fallback={<FormSkeleton />}>
        <ReportContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
