import { z } from "zod";
import { emailAddressSchema } from "@/lib/urls";

export const leadSchema = z.object({
  blockId: z.uuid(),
  email: emailAddressSchema,
  name: z.string().trim().max(120, "Use at most 120 characters.").optional(),
  message: z.string().trim().max(4000, "Use at most 4000 characters.").optional(),
  consent: z.literal("on", { error: "Please tick the box to continue." }),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120, "Use at most 120 characters."),
  email: emailAddressSchema,
  message: z.string().trim().min(1, "Enter a message.").max(4000, "Use at most 4000 characters."),
});

export function leadConsentText(kind: "newsletter" | "contact", ownerName: string): string {
  return kind === "newsletter"
    ? `I agree that ${ownerName} may email me updates. I can ask them to remove me at any time.`
    : `I agree to share these details with ${ownerName} so that they can reply to me.`;
}
