import Link from "next/link";
import type { Metadata } from "next";
import { ConsentPanel } from "@/components/ConsentPanel";
import { Icon } from "@/components/Icon";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Account",
  description: "Mock athlete account panel with recording consents.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

export default function AccountPage() {
  const repo = getRepository();
  const db = repo.getDb();
  const slug = db.mockAccountAthleteSlug ?? "vitomir-maricic";
  const athlete = repo.getAthleteBySlug(slug) ?? repo.listAthletes({})[0];
  const consents = athlete ? repo.listConsents(athlete.slug) : [];
  const junior = repo.getAthleteBySlug("demo-junior-diver");

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Account</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Athlete panel (mock)</h1>
          <p>
            Signed-in experience is stubbed. Consents persist in localStorage and
            seed defaults drive shop / dive enforcement.
          </p>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Profile</h2>
          <p className="muted small" style={{ marginTop: 8 }}>
            {athlete
              ? `${athlete.name} · ${athlete.claimed ? "claimed" : "unclaimed"} mock account`
              : "No athlete in seed"}
          </p>
          {athlete && (
            <Link
              className="btn btn--sm"
              href={`/athletes/${athlete.slug}`}
              style={{ marginTop: 14 }}
            >
              View public profile
            </Link>
          )}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>My library</h2>
          <p className="muted small" style={{ marginTop: 8 }}>
            Purchased clips appear after checkout is wired. Only Diveye-owned
            (AIDA) titles with consent clear the shop gate.
          </p>
          <Link className="btn btn--sm btn--ghost" href="/shop" style={{ marginTop: 14 }}>
            Browse shop
          </Link>
        </div>
        {athlete && (
          <div style={{ gridColumn: "1 / -1" }}>
            <ConsentPanel
              athleteSlug={athlete.slug}
              athleteName={athlete.name}
              minor={athlete.minor}
              guardianConsentGranted={athlete.guardianConsentGranted}
              seedConsents={consents}
            />
          </div>
        )}
        {junior && (
          <div style={{ gridColumn: "1 / -1" }}>
            <ConsentPanel
              athleteSlug={junior.slug}
              athleteName={`${junior.name} (junior demo)`}
              minor
              guardianConsentGranted={junior.guardianConsentGranted}
              seedConsents={repo.listConsents(junior.slug)}
            />
          </div>
        )}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Orders</h2>
          <p className="muted small" style={{ marginTop: 8 }}>
            Cart stub — no payment processor in this task.
          </p>
          <Link className="btn btn--sm" href="/cart" style={{ marginTop: 14 }}>
            Open cart
          </Link>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Claim queue (seed)</h2>
          <p className="muted small" style={{ marginTop: 8 }}>
            {repo.listClaimRequests().length} logged request(s). New claims go to{" "}
            {db.claimsInbox ?? "claims@depthboard.com"}.
          </p>
          <Link className="btn btn--sm btn--ghost" href="/claim" style={{ marginTop: 14 }}>
            Open claim form
          </Link>
        </div>
      </div>
    </div>
  );
}
