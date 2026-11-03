import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DemoPhone } from "@/features/marketing/components/theme-showcase";
import { PRESET_LABELS } from "@/features/themes/presets";
import { PRESET_IDS } from "@/features/themes/schema";

export const metadata: Metadata = {
  title: "Themes",
  description: "Ten starting points for your FindMe page. Adjust colours, fonts, buttons and layout until it's yours.",
  alternates: { canonical: "/themes" },
};

export default function ThemesPage() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6">
      <div className="grid max-w-2xl gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Find your look</h1>
        <p className="text-lg text-muted-foreground">
          Ten starting points, shown here on a sample page. Every one can be adjusted, from colours and fonts to buttons and layout.
        </p>
      </div>
      <ul className="grid justify-items-center gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {PRESET_IDS.map((id) => (
          <li key={id} className="grid w-full justify-items-center gap-3">
            <DemoPhone preset={id} label={`Sample page using the ${PRESET_LABELS[id]} theme`} />
            <h2 className="font-medium">{PRESET_LABELS[id]}</h2>
          </li>
        ))}
      </ul>
      <Link href="/register" className={`${buttonVariants({ size: "lg" })} justify-self-center`}>Create your free page</Link>
    </main>
  );
}
