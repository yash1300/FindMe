export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading" className="grid gap-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
