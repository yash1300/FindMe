import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { requireOnboardedUser } from "@/features/auth/session";
import { DashboardNav } from "./nav";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

function SignOut() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm" className="text-gray-300 hover:bg-white/10 hover:text-white">
        Log out
      </Button>
    </form>
  );
}

async function AccountName() {
  const { account } = await requireOnboardedUser();
  return <p className="truncate px-3 text-sm text-gray-300">{account.display_name}</p>;
}

/**
 * This shell is static and holds no user data. Every page in this segment authorises itself
 * by calling requireOnboardedUser, because a layout's check would not protect its pages:
 * layouts don't re-run on client navigation and can be bypassed by a direct RSC request.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-brand-grey lg:flex-row">
      {/* Mobile */}
      <header className="bg-brand-midnight p-3 text-white lg:hidden">
        <div className="flex items-center justify-between px-1 pb-2">
          <Logo href="/dashboard" />
          <SignOut />
        </div>
        <DashboardNav orientation="horizontal" />
      </header>

      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 flex-col gap-8 bg-brand-midnight p-4 text-white lg:flex">
        <Logo href="/dashboard" className="px-3 pt-2" />
        <div className="flex-1">
          <DashboardNav orientation="vertical" />
        </div>
        <div className="grid gap-1 border-t border-white/10 pt-3">
          <Suspense fallback={<div className="mx-3 h-5 animate-pulse rounded bg-white/10" />}>
            <AccountName />
          </Suspense>
          <SignOut />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
