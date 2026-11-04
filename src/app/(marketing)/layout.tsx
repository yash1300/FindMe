import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/themes", label: "Themes" },
  { href: "/faq", label: "FAQ" },
];

const FOOTER = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 p-4 sm:p-6">
        <Logo />
        <nav aria-label="Main" className="order-3 flex w-full gap-4 overflow-x-auto text-sm md:order-none md:w-auto">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0 text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Account" className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Log in
          </Link>
          <Link href="/register" className={buttonVariants()}>
            Sign up
          </Link>
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground sm:p-6">
          <p>Your entire world. One link.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            {FOOTER.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
