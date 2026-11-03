import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between p-4 sm:p-6">
        <Logo />
        <nav aria-label="Account" className="flex items-center gap-2">
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
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
