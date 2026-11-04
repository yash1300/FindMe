import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <main className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
      <aside
        aria-hidden
        className="hidden flex-col justify-end overflow-hidden bg-brand-midnight bg-[radial-gradient(ellipse_at_top_right,#7657f655,transparent_60%),radial-gradient(ellipse_at_bottom_left,#20c99733,transparent_55%)] p-12 text-white lg:flex"
      >
        <p className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Your entire world. One link.</p>
      </aside>
    </div>
  );
}
