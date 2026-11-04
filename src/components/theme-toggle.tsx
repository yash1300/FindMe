"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Which icon shows is decided by CSS, so the server's HTML is right whichever theme is active. */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("fm-theme", isDark ? "dark" : "light");
    } catch {
      // Private browsing can block storage. The theme still changes for this page.
    }
  }

  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Switch between light and dark mode" title="Switch between light and dark mode" onClick={toggle} className={className}>
      <Moon className="dark:hidden" aria-hidden />
      <Sun className="hidden dark:block" aria-hidden />
    </Button>
  );
}
