import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className, prefetch }: { href?: string; className?: string; prefetch?: boolean }) {
  return (
    <Link href={href} prefetch={prefetch} className={cn("inline-flex items-center gap-2 text-lg font-semibold tracking-tight", className)}>
      <span aria-hidden className="relative flex size-5 items-center justify-center rounded-full bg-brand-violet">
        <span className="size-1.5 rounded-full bg-brand-mint" />
      </span>
      FindMe
    </Link>
  );
}
