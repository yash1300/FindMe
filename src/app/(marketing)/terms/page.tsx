import type { Metadata } from "next";
import { TERMS_VERSION } from "@/features/legal/versions";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using FindMe.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" version={TERMS_VERSION}>
      <section>
        <h2>Your account</h2>
        <p>You&apos;re responsible for keeping your login details safe and for what happens under your account.</p>
      </section>
      <section>
        <h2>Your content</h2>
        <p>
          Your content stays yours. You give us permission to store and display it so that we can run your page. You
          must have the right to share anything you post.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don&apos;t impersonate others or mislead visitors.</li>
          <li>Don&apos;t post or link to illegal content, malware, or scams.</li>
          <li>Don&apos;t attack, overload, or try to bypass the security of the service.</li>
        </ul>
      </section>
      <section>
        <h2>Usernames</h2>
        <p>Usernames are first come, first served. We may reclaim names that are abusive or impersonate someone.</p>
      </section>
      <section>
        <h2>Suspension</h2>
        <p>We may suspend accounts or pages that break these terms.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>When these terms change, we&apos;ll ask you to review and accept the new version.</p>
      </section>
    </LegalPage>
  );
}
