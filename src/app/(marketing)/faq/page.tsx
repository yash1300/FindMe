import type { Metadata } from "next";
import Link from "next/link";
import { FAQ_ITEMS } from "@/features/marketing/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about FindMe.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Frequently asked questions</h1>
      <div className="grid gap-2">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="rounded-xl border p-4">
            <summary className="cursor-pointer font-medium">{item.question}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Still curious? <Link href="/contact" className="font-medium text-foreground underline underline-offset-2">Contact us</Link>.
      </p>
    </main>
  );
}
