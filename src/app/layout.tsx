import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { getAppUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const description =
  "Bring your links, content, socials, and brand together in one beautiful place. Create your FindMe page in minutes.";

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
    <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
