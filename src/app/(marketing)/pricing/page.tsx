import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "FindMe is free to start. See what's included today and what paid plans are planned.",
  alternates: { canonical: "/pricing" },
};

const PLANS = [
  {
    name: "Free",
    status: "Available now",
    features: ["One page", "All blocks and links", "All themes and customisation", "QR codes and sharing", "Newsletter and contact forms", "FindMe branding on your page"],
    available: true,
  },
  {
    name: "Pro",
    status: "Planned",
    features: ["Everything in Free", "Advanced analytics", "Remove FindMe branding", "More customisation"],
    available: false,
  },
  {
    name: "Business",
    status: "Planned",
    features: ["Everything in Pro", "Custom domains", "Multiple profiles", "Lead management tools", "Priority support"],
    available: false,
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6">
      <div className="grid max-w-2xl gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Start free</h1>
        <p className="text-lg text-muted-foreground">
          FindMe is free to use today. Paid plans aren&apos;t on sale yet. When they arrive they&apos;ll be priced in rupees, with UPI and GST-aware invoices, and plans may change before then.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <section key={plan.name} className={`grid content-start gap-4 rounded-2xl border p-6 ${plan.available ? "border-brand-violet" : "border-dashed"}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${plan.available ? "bg-emerald-100 text-emerald-950" : "bg-muted"}`}>{plan.status}</span>
            </div>
            <ul className="grid gap-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-violet" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            {plan.available ? <Link href="/register" className={buttonVariants()}>Create your free page</Link> : null}
          </section>
        ))}
      </div>
    </main>
  );
}
