import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "Why FindMe exists, and what we care about.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  { title: "Your page should look like you", text: "Good design shouldn't be a paid extra. FindMe is free, and everyone gets the full set of themes and controls." },
  { title: "Built for India first", text: "We're starting with what people here need, and we'll grow from there." },
  { title: "Privacy by design", text: "We collect what the service needs, and we won't invent numbers or promise more than we can deliver." },
];

export default function AboutPage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-10 px-4 py-14 sm:px-6">
      <div className="grid gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Everything you are, in one link</h1>
        <p className="text-lg text-muted-foreground">
          Most of us are spread across many platforms, yet most of them give us one small space for a link. FindMe turns that one link into a page that brings everything together, and that feels like yours.
        </p>
      </div>
      <div className="grid gap-4">
        {VALUES.map((value) => (
          <section key={value.title} className="rounded-xl border p-5">
            <h2 className="font-medium">{value.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{value.text}</p>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/register" className={buttonVariants()}>Create your free page</Link>
        <Link href="/contact" className={buttonVariants({ variant: "outline" })}>Contact us</Link>
      </div>
    </main>
  );
}
