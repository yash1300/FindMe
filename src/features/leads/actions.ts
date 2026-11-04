"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  type ActionState,
  formError,
  formValues,
  tooManyAttempts,
  UNAVAILABLE_MESSAGE,
  validationError,
} from "@/features/auth/action-state";
import { requireProfileOwner } from "@/features/auth/session";
import { sendEmail } from "@/lib/email";
import { getAppUrl, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimits, RATE_LIMITS, rateLimitKey } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAnonClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { contactSchema, leadConsentText, leadSchema } from "./schema";

const THANKS: Record<"newsletter" | "contact", string> = {
  newsletter: "Thanks for subscribing!",
  contact: "Thanks! Your message has been sent.",
};

/** Accepts a newsletter signup or contact-form message from a public page. */
export async function submitLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formValues(formData, ["blockId", "email", "name", "message", "consent", "website"]);
  const values = { email: raw.email ?? "", name: raw.name ?? "", message: raw.message ?? "" };

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  // Only bots fill this hidden field. They get a normal-looking reply, so they don't adapt.
  if (raw.website) return { status: "success", message: "Thanks!" };

  if (!isSupabaseConfigured()) return formError(UNAVAILABLE_MESSAGE, values);

  const ip = getClientIp(await headers());
  const limit = await checkRateLimits([
    [rateLimitKey("lead:ip", ip), RATE_LIMITS.leadByIp],
    [rateLimitKey("lead:ip_block", `${ip}:${parsed.data.blockId}`), RATE_LIMITS.leadByIpAndBlock],
  ]);
  if (limit.status === "limited") return tooManyAttempts(limit.retryAfterSeconds, values);
  if (limit.status === "unavailable") return formError(UNAVAILABLE_MESSAGE, values);

  // Reading through the public view means hidden, expired or unpublished forms can't collect anything.
  const { data: block, error: blockError } = await createSupabaseAnonClient()
    .from("public_blocks")
    .select("id, profile_id, type, config")
    .eq("id", parsed.data.blockId)
    .in("type", ["newsletter", "contact_form"])
    .maybeSingle<{ id: string; profile_id: string; type: "newsletter" | "contact_form"; config: Record<string, unknown> }>();

  if (blockError) {
    logger.error("leads.block_lookup_failed", { code: blockError.code });
    return formError(UNAVAILABLE_MESSAGE, values);
  }
  if (!block) return formError("This form is no longer available.", values);

  const kind = block.type === "newsletter" ? "newsletter" : "contact";
  if (kind === "contact" && !parsed.data.message) {
    return { status: "error", fieldErrors: { message: "Enter a message." }, values };
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("owner_id, display_name")
    .eq("id", block.profile_id)
    .single<{ owner_id: string; display_name: string }>();
  if (profileError) {
    logger.error("leads.profile_lookup_failed", { code: profileError.code });
    return formError(UNAVAILABLE_MESSAGE, values);
  }

  const { error } = await admin.from("leads").insert({
    profile_id: block.profile_id,
    block_id: block.id,
    kind,
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name || null,
    message: kind === "contact" ? parsed.data.message : null,
    consent_text: leadConsentText(kind, profile.display_name),
    // Labels come from the stored form, so a visitor can't invent extra fields.
    custom_fields: Object.fromEntries(
      ["1", "2", "3"].flatMap((number) => {
        const label = block.config[`field${number}`];
        const value = formData.get(`custom${number}`);
        return typeof label === "string" && typeof value === "string" && value.trim() ? [[label, value.trim().slice(0, 500)]] : [];
      }),
    ),
  });

  // A repeat of the same signup is fine, and the reply must not reveal that it was a repeat.
  if (error && error.code !== "23505") {
    logger.error("leads.insert_failed", { code: error.code });
    return formError(UNAVAILABLE_MESSAGE, values);
  }

  if (!error && kind === "contact") {
    const { data: owner } = await admin.auth.admin.getUserById(profile.owner_id);
    if (owner.user?.email) {
      await sendEmail({
        to: owner.user.email,
        subject: "New message from your FindMe page",
        replyTo: parsed.data.email,
        text: [
          `From: ${parsed.data.name || "Someone"} <${parsed.data.email}>`,
          "",
          parsed.data.message ?? "",
          "",
          `See all your messages: ${getAppUrl()}/dashboard/audience`,
        ].join("\n"),
      });
    }
  }

  return { status: "success", message: THANKS[kind] };
}

/** Lets a creator remove a person's details, such as when asked to. */
export async function deleteLeadAction(formData: FormData): Promise<void> {
  const { profile } = await requireProfileOwner();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("leads").delete().eq("id", id).eq("profile_id", profile.id);
  if (error) logger.error("leads.delete_failed", { code: error.code });
  revalidatePath("/dashboard/audience");
}

/** Contact form on the marketing site. Stored first, so a message survives an email failure. */
export async function submitContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formValues(formData, ["name", "email", "message", "website"]);
  const values = { name: raw.name ?? "", email: raw.email ?? "", message: raw.message ?? "" };

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);
  if (raw.website) return { status: "success", message: "Thanks! We'll be in touch." };
  if (!isSupabaseConfigured()) return formError(UNAVAILABLE_MESSAGE, values);

  const limit = await checkRateLimits([[rateLimitKey("contact:ip", getClientIp(await headers())), RATE_LIMITS.leadByIp]]);
  if (limit.status === "limited") return tooManyAttempts(limit.retryAfterSeconds, values);
  if (limit.status === "unavailable") return formError(UNAVAILABLE_MESSAGE, values);

  const { error } = await createSupabaseAdminClient().from("contact_submissions").insert(parsed.data);
  if (error) {
    logger.error("contact.insert_failed", { code: error.code });
    return formError(UNAVAILABLE_MESSAGE, values);
  }

  const inbox = process.env.CONTACT_INBOX_EMAIL;
  if (inbox) {
    await sendEmail({
      to: inbox,
      subject: "New FindMe contact form message",
      replyTo: parsed.data.email,
      text: `From: ${parsed.data.name} <${parsed.data.email}>\n\n${parsed.data.message}`,
    });
  }

  return { status: "success", message: "Thanks! We'll be in touch." };
}
