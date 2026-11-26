import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Claim your profile",
  description: "Request to claim an athlete profile on Depthboard.",
  alternates: { canonical: "/claim" },
};

export default function ClaimPage() {
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
          <p>Manual verification via email. For juniors, a guardian must complete the claim.</p>
        </div>
      </div>
      <form className="card" style={{ padding: 24, maxWidth: 560 }} action="#" method="post">
        <label className="stack" style={{ gap: 6, marginBottom: 14 }}>
          <span className="small">Athlete name</span>
          <input name="name" required placeholder="As on federation start lists" style={{ minHeight: 44, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text)", padding: "0 12px" }} />
        </label>
        <label className="stack" style={{ gap: 6, marginBottom: 14 }}>
          <span className="small">Email for verification</span>
          <input name="email" type="email" required placeholder="you@example.com" style={{ minHeight: 44, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text)", padding: "0 12px" }} />
        </label>
        <label className="stack" style={{ gap: 6, marginBottom: 14 }}>
          <span className="small">Federation ID (optional)</span>
          <input name="fedId" placeholder="AIDA / CMAS athlete id" style={{ minHeight: 44, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text)", padding: "0 12px" }} />
        </label>
        <label className="row" style={{ gap: 10, marginBottom: 18 }}>
          <input type="checkbox" name="guardian" />
          <span className="small">I am a guardian claiming for a minor</span>
        </label>
        <button className="btn btn--primary" type="button">
          <Icon name="mail" /> Submit claim (mock)
        </button>
        <p className="caption" style={{ marginTop: 12 }}>MVP posts nowhere — wire to support inbox later.</p>
      </form>
    </div>
  );
}
