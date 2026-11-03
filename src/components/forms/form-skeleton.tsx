/** Placeholder shown while request-time content streams in behind a Suspense boundary. */
export function FormSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="grid gap-4">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-lg bg-muted" />
      ))}
      <div className="h-8 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
