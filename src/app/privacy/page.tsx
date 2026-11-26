import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Depthboard handles personal data.",
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
      <p className="muted">Placeholder legal copy for the English MVP. Have counsel review before production.</p>
      <h2>Scope</h2>
      <p>Depthboard publishes federation results, athlete profiles and Diveye footage commerce stubs.</p>
      <h2>Data</h2>
      <ul>
        <li>Competition results from AIDA and CMAS sources (seed/JSON in MVP).</li>
        <li>Account and claim flows are mocked — no production auth yet.</li>
        <li>Minors: public profiles are restricted and default to noindex.</li>
      </ul>
      <h2>Contact</h2>
      <p>privacy@depthboard.com (placeholder).</p>
    </div>
  );
}
