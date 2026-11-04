import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DailyRow } from "./summary";

/** Daily totals for the owner's page. RLS means it can only ever return their own. */
export async function getDailyRows(profileId: string, from: string, to: string): Promise<DailyRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("analytics_daily")
    .select("day, dimension, dimension_value, views, clicks, uniques")
    .eq("profile_id", profileId)
    .gte("day", from)
    .lte("day", to)
    .order("day")
    .limit(20000);
  if (error) throw new Error(`Could not load analytics: ${error.message}`);
  return data as DailyRow[];
}
