import { z } from "zod";
import { isBlockedUsername } from "./reserved";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/** Format rules. Must stay in step with public.is_valid_username_format in the database. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN_LENGTH, `Use at least ${USERNAME_MIN_LENGTH} characters.`)
  .max(USERNAME_MAX_LENGTH, `Use at most ${USERNAME_MAX_LENGTH} characters.`)
  .regex(
    /^[a-z0-9]+([_-][a-z0-9]+)*$/,
    "Use letters, numbers, and single hyphens or underscores. Start and end with a letter or number.",
  )
  // Deliberately doesn't say which list matched.
  .refine((value) => !isBlockedUsername(value), "This username isn't available.");
