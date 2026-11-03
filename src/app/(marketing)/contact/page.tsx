import type { Metadata } from "next";
import { MarketingContactForm } from "@/features/marketing/components/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the FindMe team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 px-4 py-14 sm:px-6">
      <div className="grid gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">Contact us</h1>
        <p className="text-muted-foreground">Questions, ideas or problems: send us a message. We use your details only to reply.</p>
      </div>
      <MarketingContactForm />
    </main>
  );
}
