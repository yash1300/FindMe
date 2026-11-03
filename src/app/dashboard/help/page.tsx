import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help" };

const TOPICS = [
  { title: "Publish your page", text: "Go to My Page and choose Publish page. Your page stays a private draft until you do.", href: "/dashboard/my-page" },
  { title: "Add links and content", text: "Links holds everything on your page, including videos, music and forms. Drag to reorder.", href: "/dashboard/links" },
  { title: "Schedule a link", text: "Open a block's Schedule section to set when it appears and when it's hidden. Changes can take up to a minute to show.", href: "/dashboard/links" },
  { title: "Change how your page looks", text: "Appearance has themes, colours, fonts and buttons. Changes save automatically, and you can undo them.", href: "/dashboard/appearance" },
  { title: "Share your page", text: "QR Code has your code to download, plus your link and sharing buttons.", href: "/dashboard/qr" },
  { title: "See who's reached out", text: "Audience lists newsletter signups and messages from your page's forms.", href: "/dashboard/audience" },
];

export default function HelpPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Help</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {TOPICS.map((topic) => (
          <Card key={topic.title}>
            <CardHeader>
              <CardTitle><Link href={topic.href} prefetch={false} className="underline-offset-2 hover:underline">{topic.title}</Link></CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{topic.text}</CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Need something else? <Link href="/contact" className="font-medium text-foreground underline underline-offset-2">Contact us</Link>.
      </p>
    </div>
  );
}
