import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-muted-foreground">This page doesn&apos;t exist or is no longer available.</p>
      <Link href="/" className={buttonVariants()}>
        Back to FindMe
      </Link>
    </main>
  );
}
