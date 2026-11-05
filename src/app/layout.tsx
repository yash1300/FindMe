import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { getAppUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Runs before the page paints, so that dark mode doesn't flash white. A fixed string with no user input.
const THEME_SCRIPT = `try{var t=localStorage.getItem("fm-theme");document.documentElement.classList.toggle("dark",t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches)}catch(e){}`;

const description =
  "Bring your links, content, socials, and brand together in one beautiful place. Completely free for everyone. Create your FindMe page in minutes.";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: { default: "FindMe: Your entire world. One link.", template: "%s | FindMe" },
  description,
  openGraph: {
    title: "FindMe: Your entire world. One link.",
    description,
    siteName: "FindMe",
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The class is set by the script before first paint, so the server's HTML can't know it.
    <html lang="en-IN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Script id="theme" strategy="beforeInteractive">{THEME_SCRIPT}</Script>
        {children}
      </body>
    </html>
  );
}
