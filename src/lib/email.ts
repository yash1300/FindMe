import "server-only";

import { logger } from "@/lib/logger";

type Message = {
  to: string;
  subject: string;
  /** Plain text only, so visitor-supplied content can never become HTML in someone's inbox. */
  text: string;
  replyTo?: string;
};

export type EmailResult = "sent" | "not_configured" | "failed";

/** Sends through Resend. Without credentials it reports that and does nothing, so callers can carry on. */
export async function sendEmail({ to, subject, text, replyTo }: Message): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return "not_configured";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        // Line breaks in a subject are a classic header-injection route.
        subject: subject.replace(/[\r\n]+/g, " ").slice(0, 200),
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      logger.error("email.send_failed", { status: response.status });
      return "failed";
    }
    return "sent";
  } catch (error) {
    logger.error("email.send_failed", { error });
    return "failed";
  }
}
