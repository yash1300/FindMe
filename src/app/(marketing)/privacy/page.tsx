import type { Metadata } from "next";
import { PRIVACY_VERSION } from "@/features/legal/versions";
import { getSupportEmail } from "@/lib/env";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How FindMe handles your personal data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  const supportEmail = getSupportEmail();
  return (
    <LegalPage title="Privacy Policy" version={PRIVACY_VERSION}>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: your name, email address, username, and password (stored only as a secure hash).</li>
          <li>If you sign in with Google: your name and email address from your Google account.</li>
          <li>A record of which version of these documents you accepted, and when.</li>
          <li>Anything you add to your page, including images you upload, which is public once you publish it.</li>
          <li>If you contact us: your name, email address and message.</li>
        </ul>
      </section>
      <section>
        <h2>Why we use it</h2>
        <p>
          To create and secure your account, show your page, send essential emails such as confirmations and password
          resets, and protect the service from abuse.
        </p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>
          We use essential cookies to keep you signed in and to complete password resets. We don&apos;t currently use
          advertising or analytics cookies.
        </p>
      </section>
      <section>
        <h2>Abuse protection</h2>
        <p>
          To limit repeated attempts, we briefly keep counters tied to scrambled (hashed) versions of IP addresses and
          email addresses. We don&apos;t store the original values in these counters.
        </p>
      </section>
      <section>
        <h2>Forms on creators&apos; pages</h2>
        <p>
          If you fill in a newsletter or contact form on someone&apos;s FindMe page, your details and your consent are stored
          for that creator, who can see and delete them. They are responsible for how they use your details after that.
        </p>
      </section>
      <section>
        <h2>Embedded content</h2>
        <p>
          Creators can embed videos and music. Video players load only when you press play. Spotify and SoundCloud players
          load with the page. These services receive your IP address and may set their own cookies, under their own policies.
        </p>
      </section>
      <section>
        <h2>Who processes your data</h2>
        <p>We rely on service providers to run FindMe, including Supabase (database, sign-in and file storage), Vercel (hosting) and Resend (email).</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can change your name, email address, and password in Settings. You can ask for a copy of your data or
          for your account to be deleted{supportEmail ? " by contacting us" : ""}.
          {supportEmail ? (
            <>
              {" "}
              Write to <a href={`mailto:${supportEmail}`} className="underline">{supportEmail}</a>.
            </>
          ) : null}
        </p>
      </section>
    </LegalPage>
  );
}
