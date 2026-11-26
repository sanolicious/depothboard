import Link from "next/link";
import type { Metadata } from "next";
import { ClaimForm } from "@/components/ClaimForm";
import { Icon } from "@/components/Icon";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Claim your profile",
  description: "Request to claim an athlete profile on Depthboard.",
  alternates: { canonical: "/claim" },
};

export default function ClaimPage() {
  const db = getRepository().getDb();
  const inbox = db.claimsInbox ?? "claims@depthboard.com";
  const recent = getRepository().listClaimRequests().slice(-5).reverse();

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Claim</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Claim your profile</h1>
          <p>
            Manual verification via {inbox}. For juniors, a guardian must
            complete the claim and recording consents.
          </p>
        </div>
      </div>
      <ClaimForm inbox={inbox} />

      {recent.length > 0 && (
        <div className="card" style={{ padding: 20, marginTop: 28, maxWidth: 560 }}>
          <h2 style={{ fontSize: "1.1rem" }}>Recent claim log (seed / JSON)</h2>
          <ul style={{ marginTop: 12, paddingLeft: 18 }}>
            {recent.map((c) => (
              <li key={c.id} className="small muted" style={{ marginBottom: 8 }}>
                <strong style={{ color: "var(--text)" }}>{c.athleteName}</strong>{" "}
                · {c.status} · {c.createdAt.slice(0, 10)}
                {c.guardian ? " · guardian" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
