import { Eye, Link2, Palette, Plus, Share2, UserRound } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarList, MetricCards } from "@/features/analytics/components/analytics-parts";
import { TrendChart } from "@/features/analytics/components/trend-chart";
import { getDailyRows } from "@/features/analytics/queries";
import { parseRange, summarize, todayInIndia } from "@/features/analytics/summary";
import { requireOnboardedUser } from "@/features/auth/session";
import { blockState } from "@/features/blocks/schedule";
import { getOwnerContent } from "@/features/profile/queries";
import { getAppUrl } from "@/lib/env";

const STATUS_COPY = {
  draft: { label: "Draft", text: "Only you can see your page. Publish it from My Page when you're ready." },
  published: { label: "Published", text: "Your page is live." },
  unpublished: { label: "Unpublished", text: "Your page is hidden from visitors." },
  suspended: { label: "Suspended", text: "This page has been suspended by FindMe." },
} as const;

const QUICK_ACTIONS = [
  { href: "/dashboard/my-page", label: "Edit page", icon: UserRound },
  { href: "/dashboard/links?add=1", label: "Add link", icon: Plus },
  { href: "/dashboard/appearance", label: "Customize", icon: Palette },
  { href: "/dashboard/preview", label: "Preview", icon: Eye },
  { href: "/dashboard/qr", label: "Share", icon: Share2 },
];

export default async function DashboardPage() {
  const { account, profile } = await requireOnboardedUser();
  const range = parseRange({ range: "30" }, todayInIndia());
  const [{ blocks, socialLinks }, rows] = await Promise.all([getOwnerContent(profile.id), getDailyRows(profile.id, range.from, range.to)]);
  const summary = summarize(rows, range);
  const titleOf = (id: string) => {
    const title = blocks.find((block) => block.id === id)?.config.title;
    return typeof title === "string" ? title : "Deleted link";
  };

  const activeLinks = blocks.filter(
    (block) => ["link", "featured_link", "product_card"].includes(block.type) && blockState(block) === "live",
  ).length;
  const visibleSocial = socialLinks.filter((link) => link.is_visible).length;
  const status = STATUS_COPY[profile.status];
  const baseUrl = getAppUrl();
  const host = baseUrl.replace(/^https?:\/\//, "");

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {account.display_name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your page</CardTitle>
          <CardDescription>{status.text}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Link</p>
            {profile.status === "published" ? (
              <a href={`${baseUrl}/${profile.username}`} target="_blank" rel="noopener noreferrer" className="font-medium break-all underline underline-offset-2">
                {host}/{profile.username}
              </a>
            ) : (
              <p className="font-medium break-all">{host}/{profile.username}</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{status.label}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Active links</CardDescription>
            <CardTitle className="text-3xl" data-testid="active-links">{activeLinks.toLocaleString("en-IN")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Social links</CardDescription>
            <CardTitle className="text-3xl">{visibleSocial.toLocaleString("en-IN")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="grid gap-3" aria-label="Last 30 days">
        <h2 className="text-sm font-medium text-muted-foreground">Last 30 days</h2>
        <MetricCards summary={summary} />
        {summary.views > 0 || summary.clicks > 0 ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart series={summary.series} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top links</CardTitle>
              </CardHeader>
              <CardContent>
                <BarList barColor="#0f8f6b" emptyText="No clicks yet." rows={summary.blockClicks.slice(0, 5).map((item) => ({ label: titleOf(item.blockId), value: item.clicks }))} />
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3" aria-label="Quick actions">
        <h2 className="text-sm font-medium text-muted-foreground">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} prefetch={false} className={buttonVariants({ variant: "outline" })}>
              <Icon aria-hidden /> {label}
            </Link>
          ))}
        </div>
      </section>

      {blocks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Link2 className="size-4" aria-hidden /> Add your first link</CardTitle>
            <CardDescription>Your page has no content yet. Links, videos, music and more all live under Links.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
