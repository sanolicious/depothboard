import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Terms for using Depthboard, including recording rights and licences.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return (
    <div className="container section legal">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Terms of use</span>
      </nav>
      <h1 style={{ marginTop: 16 }}>Terms of use</h1>
      <p className="muted">
        English MVP draft — not legal advice. Have counsel review before
        production launch.
      </p>

      <h2>Service</h2>
      <p>
        Depthboard provides rankings, results, athlete pages, a Diveye footage
        shop with Stripe Checkout when keys are set (otherwise simulated pay —
        see /shop), and a coaching marketplace with simulated booking pay (see
        /coaching).
      </p>

      <h2>Recording rights</h2>
      <ul>
        <li>
          <strong>AIDA events:</strong> where Diveye produces the archive,
          Diveye holds full rights to host, preview and sell licence tiers
          (sample / social / master / commercial), subject to athlete consent.
        </li>
        <li>
          <strong>CMAS events:</strong> Depthboard may embed or link official
          transmissions only. Downloadable products and shop sales for CMAS
          footage are disabled.
        </li>
        <li>
          Federation result data is separate from media rights; a result page
          does not imply a sellable clip.
        </li>
      </ul>

      <h2>Athlete consents</h2>
      <p>
        Licence sales require active consents for recording and publication.
        Commercial licences additionally require commercial-use consent.
        Athletes may withdraw consents; withdrawn items become unavailable in
        the shop and archive.
      </p>

      <h2>Minors</h2>
      <p>
        Junior profiles are privacy-restricted. Guardians must complete the
        claim and consent steps before Diveye may publish or license junior
        recordings.
      </p>

      <h2>Licence tiers</h2>
      <ul>
        <li>
          <strong>Sample</strong> — free watermarked preview when rights allow.
        </li>
        <li>
          <strong>Social</strong> — personal / social-media edit.
        </li>
        <li>
          <strong>Master</strong> — higher-quality non-broadcast file.
        </li>
        <li>
          <strong>Commercial</strong> — ads, sponsors, broadcast.
        </li>
      </ul>

      <h2>Claims</h2>
      <p>
        Profile ownership is requested via the claim form and{" "}
        <a href="mailto:claims@depthboard.com">claims@depthboard.com</a>. Manual
        steward verification applies.
      </p>

      <h2>Contact</h2>
      <p>legal@depthboard.com (placeholder).</p>
    </div>
  );
}
