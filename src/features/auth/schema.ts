import { z } from "zod";
import { usernameSchema } from "@/features/usernames/schema";

export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt silently ignores everything past 72 bytes, and multi-byte characters count for more. */
export const PASSWORD_MAX_BYTES = 72;

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES, "That password is too long.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(80, "Use at most 80 characters.");

const consentSchema = z.literal("on", { error: "Please accept the Terms and Privacy Policy to continue." });

export const registerSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  consent: consentSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(1024),
});

export const emailOnlySchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(1024),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export const updateNameSchema = z.object({ name: displayNameSchema });
