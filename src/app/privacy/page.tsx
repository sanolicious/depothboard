import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Depthboard handles personal data, minors and recording consents.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return (
    <div className="container section legal">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Privacy policy</span>
      </nav>
      <h1 style={{ marginTop: 16 }}>Privacy policy</h1>
      <p className="muted">
        English MVP draft — not legal advice. Have counsel review before
        production launch.
      </p>

      <h2>Scope</h2>
      <p>
        Depthboard publishes federation results, athlete profiles and Diveye
        footage commerce. Account, claim and consent flows are mocked until
        authentication ships.
      </p>

      <h2>Competition data</h2>
      <ul>
        <li>
          Results and rankings are ingested from AIDA and CMAS public sources
          with provenance tags (HTML, API, PDF, FR gap-fill).
        </li>
        <li>
          CMAS accreditation codes are hashed; birth dates are not stored from
          CMAS feeds.
        </li>
      </ul>

      <h2>Recording consents</h2>
      <ul>
        <li>
          Athletes (or guardians) grant or withdraw consents for{" "}
          <strong>recording</strong>, <strong>publication</strong>,{" "}
          <strong>commercial use</strong> and coach access.
        </li>
        <li>
          Shop and archive sales are blocked when required consents are missing.
        </li>
        <li>
          Sample previews may show a Depthboard watermark; full files require a
          cleared licence on Diveye-owned recordings.
        </li>
      </ul>

      <h2>Minors</h2>
      <ul>
        <li>
          Profiles for athletes under 18 are restricted (limited bio / contact)
          and default to <code>noindex</code>.
        </li>
        <li>
          A verified guardian must claim the profile and grant recording /
          publication consents before any Diveye use of junior footage.
        </li>
        <li>
          Competition results remain visible for safety and judging transparency.
        </li>
      </ul>

      <h2>Profile claims</h2>
      <p>
        Claim requests are emailed to{" "}
        <a href="mailto:claims@depthboard.com">claims@depthboard.com</a> and
        logged for steward review. No production OAuth in this MVP.
      </p>

      <h2>Contact</h2>
      <p>
        privacy@depthboard.com (placeholder) · claims@depthboard.com for
        profile ownership.
      </p>
    </div>
  );
}
