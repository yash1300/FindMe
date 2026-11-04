"use server";

import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionState, formError, formValues, UNAVAILABLE_MESSAGE } from "@/features/auth/action-state";
import { ACTIVE_PROFILE_COOKIE } from "@/features/auth/constants";
import { displayNameSchema } from "@/features/auth/schema";
import { getAccountContext, requireProfileOwner } from "@/features/auth/session";
import { usernameSchema } from "@/features/usernames/schema";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { limitUser } from "./guard";
import { profileTag, SITEMAP_TAG } from "./tags";

async function setActive(id: string) {
  (await cookies()).set(ACTIVE_PROFILE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createPageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireProfileOwner();
  const raw = formValues(formData, ["username", "name"]);
  const values = { username: raw.username ?? "", name: raw.name ?? "" };

  const username = usernameSchema.safeParse(raw.username ?? "");
  const name = displayNameSchema.safeParse(raw.name ?? "");
  if (!username.success || !name.success) {
    return {
      status: "error",
      values,
      fieldErrors: {
        ...(username.success ? {} : { username: username.error.issues[0].message }),
        ...(name.success ? {} : { name: name.error.issues[0].message }),
      },
    };
  }

  const limited = await limitUser(user.id);
  if (limited && !limited.ok) return formError(limited.message, values);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      owner_id: user.id,
      username: username.data,
      display_name: name.data,
      onboarding_completed_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (error.code === "23505" || error.code === "23514") {
      return { status: "error", values, fieldErrors: { username: "This username isn't available." } };
    }
    if (error.message.includes("profile limit")) return formError("You've reached the maximum number of pages.", values);
    logger.error("pages.create_failed", { code: error.code });
    return formError(UNAVAILABLE_MESSAGE, values);
  }

  await setActive(data.id);
  redirect("/dashboard/my-page");
}

export async function switchPageAction(formData: FormData): Promise<void> {
  const { user } = await requireProfileOwner();
  const id = formData.get("id");
  const { profiles } = await getAccountContext(user.id);
  if (typeof id === "string" && profiles.some((item) => item.id === id)) await setActive(id);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function deletePageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireProfileOwner();
  const { id, confirm } = formValues(formData, ["id", "confirm"]);
  const { profiles } = await getAccountContext(user.id);
  const target = profiles.find((item) => item.id === id);

  if (!target) return formError("That page no longer exists.");
  if (profiles.length === 1) return formError("You can't delete your only page. To leave FindMe, delete your account in Settings.");
  if (confirm?.trim().toLowerCase() !== target.username) {
    return { status: "error", fieldErrors: { confirm: `Type ${target.username} to confirm.` } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").delete().eq("id", target.id);
  if (error) {
    logger.error("pages.delete_failed", { code: error.code });
    return formError(UNAVAILABLE_MESSAGE);
  }

  (await cookies()).delete(ACTIVE_PROFILE_COOKIE);
  updateTag(profileTag(target.username));
  updateTag(SITEMAP_TAG);
  redirect("/dashboard/pages");
}
