import { Flag, Inbox, LayoutDashboard, ScrollText, Settings, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | FindMe admin" }, robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/support", label: "Messages", icon: Inbox },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/** Only the shell. It holds no data, and each page checks the staff role itself. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-brand-grey lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-brand-midnight p-4 text-white lg:w-56">
        <div className="flex items-center justify-between">
          <Logo href="/admin" prefetch={false} />
          <ThemeToggle className="text-gray-300 hover:bg-white/10 hover:text-white" />
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} prefetch={false} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white">
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
