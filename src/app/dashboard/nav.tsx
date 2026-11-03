"use client";

import { CircleHelp, LayoutDashboard, Link2, Palette, QrCode, Settings, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Only pages that exist are listed. Analytics, Integrations and Billing join as their phases ship.
const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/my-page", label: "My Page", icon: UserRound },
  { href: "/dashboard/links", label: "Links", icon: Link2 },
  { href: "/dashboard/appearance", label: "Appearance", icon: Palette },
  { href: "/dashboard/audience", label: "Audience", icon: Users },
  { href: "/dashboard/qr", label: "QR Code", icon: QrCode },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/help", label: "Help", icon: CircleHelp },
];

export function DashboardNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "overflow-x-auto")}>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white",
              isActive && "bg-white/10 text-white",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
