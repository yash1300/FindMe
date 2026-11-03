export type BlockState = "live" | "hidden" | "scheduled" | "expired";

export function blockState(
  block: { is_visible: boolean; starts_at: string | null; ends_at: string | null },
  now: number = Date.now(),
): BlockState {
  if (!block.is_visible) return "hidden";
  if (block.starts_at && new Date(block.starts_at).getTime() > now) return "scheduled";
  if (block.ends_at && new Date(block.ends_at).getTime() <= now) return "expired";
  return "live";
}

/** ISO to the value a datetime-local input expects, in the viewer's local time. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** A datetime-local value, read in the viewer's timezone, to ISO. Empty becomes null. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
