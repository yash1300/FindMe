/**
 * Bumping either version asks every existing user to accept again on their next dashboard
 * visit. Versions are stored on accounts as the consent record, so don't reuse a value.
 */
export const TERMS_VERSION = "2026-11-03-draft";
export const PRIVACY_VERSION = "2026-11-06-draft";

export function hasCurrentConsent(account: {
  terms_accepted_version: string | null;
  privacy_accepted_version: string | null;
}): boolean {
  return (
    account.terms_accepted_version === TERMS_VERSION &&
    account.privacy_accepted_version === PRIVACY_VERSION
  );
}
