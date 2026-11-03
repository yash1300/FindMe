export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading" className="grid gap-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
      <div className="h-40 animate-pulse rounded-xl bg-gray-200" />
    </div>
  );
}
