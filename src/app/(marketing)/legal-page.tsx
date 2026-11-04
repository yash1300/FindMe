import type { ReactNode } from "react";

export function LegalPage({ title, version, children }: { title: string; version: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <p role="note" className="mb-8 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 p-3 text-sm text-amber-950 dark:text-amber-100">
        <strong>Draft.</strong> This document has not yet been reviewed by a lawyer and may change before FindMe launches.
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Version {version}</p>
      <div className="mt-8 grid gap-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_p]:text-muted-foreground [&_ul]:mt-2 [&_ul]:grid [&_ul]:gap-1 [&_ul]:text-muted-foreground">
        {children}
      </div>
    </main>
  );
}
