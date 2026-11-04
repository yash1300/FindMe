import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { requireOnboardedUser } from "@/features/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const { account, profile } = await requireOnboardedUser();
  return (
    <div className="px-3 text-sm">
      <p className="truncate text-gray-300">{account.display_name}</p>
      <p className="truncate text-xs text-gray-400">@{profile.username}</p>
    </div>
  );
}

/** Set by admins in Settings. Plain text only, shown across the dashboard. */
async function Announcement() {
  await requireOnboardedUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "announcement").maybeSingle<{ value: string }>();
  if (typeof data?.value !== "string" || !data.value) return null;
  return (
    <p role="status" data-testid="announcement" className="mb-4 rounded-lg border bg-card p-3 text-sm">{data.value}</p>
  );
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
      <header className="min-w-0 bg-brand-midnight p-3 text-white lg:hidden">
        <div className="flex items-center justify-between px-1 pb-2">
          <Logo href="/dashboard" prefetch={false} />
          <div className="flex items-center gap-1">
            <ThemeToggle className="text-gray-300 hover:bg-white/10 hover:text-white" />
            <SignOut />
          </div>
        </div>
        <DashboardNav orientation="horizontal" />
      </header>

      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 flex-col gap-8 border-r border-transparent bg-brand-midnight p-4 text-white lg:flex dark:border-white/10">
        <Logo href="/dashboard" prefetch={false} className="px-3 pt-2" />
        <div className="flex-1">
          <DashboardNav orientation="vertical" />
        </div>
        <div className="grid gap-1 border-t border-white/10 pt-3">
          <Suspense fallback={<div className="mx-3 h-5 animate-pulse rounded bg-white/10" />}>
            <AccountName />
          </Suspense>
          <div className="flex items-center justify-between">
            <SignOut />
            <ThemeToggle className="text-gray-300 hover:bg-white/10 hover:text-white" />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={null}>
            <Announcement />
          </Suspense>
          {children}
        </div>
      </main>
    </div>
  );
}
