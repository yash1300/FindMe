// @vitest-environment node
import { describe, it } from "vitest";

/**
 * FindMe is free for everyone for now, so payments aren't built. These are the checks that paid
 * plans must pass if they're ever added, kept here so they aren't forgotten. They show as "todo"
 * in test output and don't run anything.
 */
describe("payments (not built: FindMe is free for now)", () => {
  describe("webhooks", () => {
    it.todo("rejects a webhook with a missing or invalid signature");
    it.todo("processes a repeated event only once");
    it.todo("grants access only from a verified webhook, never from the browser's success callback");
    it.todo("records failed payments without granting access");
    it.todo("records refunds against the original invoice");
  });

  describe("subscriptions", () => {
    it.todo("handles monthly and annual renewals");
    it.todo("handles upgrades and downgrades");
    it.todo("keeps access until the end of a cancelled period");
    it.todo("removes paid access after failed renewal attempts run out");
  });

  describe("entitlements", () => {
    it.todo("enforces plan limits on the server, including for direct API calls");
    it.todo("doesn't let a user change their own plan or entitlements");
  });

  describe("billing", () => {
    it.todo("never stores card details");
    it.todo("stores amounts in minor units, with the tax captured at the time of sale");
    it.todo("reads tax rates from configuration rather than code");
    it.todo("shows INR and Indian number formatting on invoices");
  });
});
