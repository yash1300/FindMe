import { BarChart3, GripVertical, LayoutDashboard, Link2, Palette, QrCode, Share2, Sparkles, Store, UserRound, Video, Wand2 } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeShowcase } from "@/features/marketing/components/theme-showcase";
import { FAQ_ITEMS } from "@/features/marketing/faq";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Claim your link", text: "Pick a username and get your own page address." },
  { title: "Add what matters", text: "Bring in your links, socials, videos, music and more." },
  { title: "Make it yours", text: "Choose a theme, then adjust colours, fonts and buttons." },
  { title: "Share it everywhere", text: "Publish, put it in your bio, and print your QR code." },
];

const SHOWCASE = [
  { icon: Link2, title: "Links and buttons", text: "Add, reorder, schedule and hide them whenever you like." },
  { icon: Video, title: "Video and music", text: "Embed YouTube, Vimeo, Spotify and SoundCloud directly on your page." },
  { icon: Store, title: "Products and services", text: "Show what you sell and send people straight to where they can buy it." },
  { icon: UserRound, title: "Ways to reach you", text: "Add contact details, a contact form or a newsletter signup." },
];

const CUSTOMIZE = ["10 starting themes", "Solid, gradient or image backgrounds", "8 typefaces", "Button styles, shapes and shadows", "Layout, spacing and width", "Picture shapes and entrance animations"];

const USE_CASES = [
  { title: "Creators", text: "Put your latest video, your socials and your shop in one place." },
  { title: "Freelancers", text: "Share your portfolio and let clients get in touch directly." },
  { title: "Artists and musicians", text: "Let your work set the tone, with players right on the page." },
  { title: "Small businesses", text: "Give customers your hours, contact details and products at one address." },
];

function SectionHeading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="grid max-w-2xl gap-2">
      <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
      {text ? <p className="text-muted-foreground">{text}</p> : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:py-20">
        <div className="grid gap-6">
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            Your entire world. <span className="block text-brand-violet">One link.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Bring your links, content, socials, and brand together in one beautiful place. Create your FindMe page in minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>Create your free page</Link>
            <Link href="/themes" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>Explore examples</Link>
          </div>
        </div>
        <ThemeShowcase />
      </section>

      <section className="bg-brand-grey">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6">
          <SectionHeading title="How FindMe works" />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border bg-card p-5">
                <span className="mb-3 flex size-8 items-center justify-center rounded-full bg-brand-midnight text-sm font-semibold text-white">{index + 1}</span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6">
        <SectionHeading title="More than a list of links" text="Build your page from blocks, and arrange them however you like." />
        <div className="grid gap-4 sm:grid-cols-2">
          {SHOWCASE.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-xl border p-5">
              <Icon className="size-5 shrink-0 text-brand-violet" aria-hidden />
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-midnight text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <Palette className="size-6 text-brand-mint" aria-hidden />
            <h2 className="text-3xl font-semibold tracking-tight">A page that looks like you</h2>
            <p className="text-gray-300">Start from a theme, then change as much as you like. Every edit shows up in a live preview, and you can undo anything.</p>
          </div>
          <ul className="grid gap-3 self-center sm:grid-cols-2">
            {CUSTOMIZE.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 shrink-0 text-brand-mint" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div className="grid content-start gap-4 rounded-2xl border p-6">
          <LayoutDashboard className="size-6 text-brand-violet" aria-hidden />
          <h2 className="text-2xl font-semibold tracking-tight">A clean place to work</h2>
          <p className="text-muted-foreground">Your dashboard keeps it simple: edit your page, reorder your links, and see who has reached out.</p>
          <ul className="grid gap-2 text-sm">
            <li className="flex items-center gap-2"><GripVertical className="size-4 text-muted-foreground" aria-hidden /> Drag and drop to reorder</li>
            <li className="flex items-center gap-2"><Wand2 className="size-4 text-muted-foreground" aria-hidden /> Automatic saving, with undo and redo</li>
            <li className="flex items-center gap-2"><QrCode className="size-4 text-muted-foreground" aria-hidden /> QR codes to download and print</li>
            <li className="flex items-center gap-2"><Share2 className="size-4 text-muted-foreground" aria-hidden /> Sharing to WhatsApp, Facebook, X, LinkedIn and email</li>
          </ul>
        </div>
        <div className="grid content-start gap-4 rounded-2xl border border-dashed p-6">
          <BarChart3 className="size-6 text-muted-foreground" aria-hidden />
          <p className="justify-self-start rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Coming soon</p>
          <h2 className="text-2xl font-semibold tracking-tight">Analytics that respect people</h2>
          <p className="text-muted-foreground">We&apos;re building views, clicks and trends for your page, designed from the start around visitors&apos; privacy.</p>
        </div>
      </section>

      <section className="bg-brand-grey">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6">
          <SectionHeading title="Made for anyone with something to share" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((item) => (
              <div key={item.title} className="rounded-xl border bg-card p-5">
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:px-6">
        <SectionHeading title="Pricing" text="FindMe is free to start. Paid plans with extra features are planned, and we'll announce prices in rupees before they launch." />
        <Link href="/pricing" className={cn(buttonVariants({ variant: "outline" }), "justify-self-start")}>See what&apos;s included</Link>
      </section>

      <section className="bg-brand-grey">
        <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="grid gap-2">
            {FAQ_ITEMS.slice(0, 4).map((item) => (
              <details key={item.question} className="rounded-xl border bg-card p-4">
                <summary className="cursor-pointer font-medium">{item.question}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
          <Link href="/faq" className="text-sm font-medium underline underline-offset-2">See all questions</Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl justify-items-center gap-5 px-4 py-20 text-center sm:px-6">
        <h2 className="text-4xl font-semibold tracking-tight">Ready to claim your link?</h2>
        <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>Create your free page</Link>
      </section>
    </main>
  );
}
