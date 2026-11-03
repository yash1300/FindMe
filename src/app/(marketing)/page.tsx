import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-6 px-4 py-20 sm:px-6">
      <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
        Your entire world. <span className="block text-brand-violet">One link.</span>
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Bring your links, content, socials, and brand together in one beautiful place. Create your FindMe page in
        minutes.
      </p>
      <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>
        Create your free page
      </Link>
    </main>
  );
}
