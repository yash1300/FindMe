/** Marks a browser that just followed a password-recovery email. Holds the user's id. */
export const RECOVERY_COOKIE = "fm_recovery";
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 15 * 60;

/** Which of a user's pages the dashboard is working on. Not a security boundary: RLS is. */
export const ACTIVE_PROFILE_COOKIE = "fm_profile";
