import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Features",
  description: "Links, blocks, themes, QR codes and more: everything FindMe can do for your page today.",
  alternates: { canonical: "/features" },
};

const AVAILABLE = [
  { title: "18 kinds of block", text: "Links, featured links, product cards, headings, text, images, YouTube, Vimeo, Spotify, SoundCloud, contact details, email and phone buttons, dividers, announcements, social icons, newsletter forms and contact forms." },
  { title: "Link management", text: "Drag and drop to reorder. Duplicate, hide, schedule and set expiry dates. Add thumbnails, icons and button styles." },
  { title: "Visual editor", text: "A live preview at phone and desktop sizes, with autosave, undo, redo and reset." },
  { title: "10 themes, fully adjustable", text: "Backgrounds, gradients, colours, typefaces, buttons, shapes, borders, shadows, spacing, layout and animations." },
  { title: "20 social platforms", text: "Reorder them, hide them, and place them anywhere on your page. Links are checked to make sure they go to the right site." },
  { title: "QR codes and sharing", text: "Download as PNG or SVG in your own colours, with your logo, and share in a tap." },
  { title: "Newsletter and contact forms", text: "Collect signups and messages with recorded consent. Only you can see them, and you can delete them at any time." },
  { title: "Publishing controls", text: "Keep your page a draft until it's ready, unpublish whenever you like, and choose whether search engines may list it." },
  { title: "Fast public pages", text: "Pages are built to load quickly, with video players that load only when someone presses play." },
];

const COMING = [
  { title: "Analytics", text: "Views, clicks and trends, designed around visitors' privacy." },
  { title: "Paid plans in rupees", text: "With UPI and GST-aware invoices." },
  { title: "Custom domains", text: "Use your own web address." },
  { title: "Multiple profiles", text: "For people and teams with more than one brand." },
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 sm:px-6">
      <div className="grid max-w-2xl gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Everything your page needs</h1>
        <p className="text-lg text-muted-foreground">Here&apos;s what you can do with FindMe today, and what&apos;s on the way.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Available now">
        {AVAILABLE.map((feature) => (
          <div key={feature.title} className="rounded-xl border p-5">
            <h2 className="font-medium">{feature.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Coming later</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COMING.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-dashed p-5">
              <h3 className="font-medium">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <Link href="/register" className={`${buttonVariants({ size: "lg" })} justify-self-start`}>Create your free page</Link>
    </main>
  );
}
