import Link from "next/link";
import type { Metadata } from "next";
import {
  FederationCrumbs,
  FederationGateHint,
  FederationSubnav,
} from "@/components/FederationShell";
import { Icon } from "@/components/Icon";
import { canAccessFederation, getSession } from "@/lib/auth";
import { JUDGE_TAG_LABELS, listEvidencePacks } from "@/lib/federation";

export const metadata: Metadata = {
  title: "Judge evidence packs",
  description:
    "Diveye FootageAsset evidence packs with markers for federation judges.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/federation/evidence" },
};

export default async function FederationEvidencePage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="container section">
        <p>
          Sign in required.{" "}
          <Link href="/login?next=/federation/evidence">Go to sign in</Link>
        </p>
      </div>
    );
  }

  if (!canAccessFederation(session)) {
    return (
      <div className="container section fed-page">
        <FederationCrumbs
          trail={[
            { href: "/federation", label: "Federation" },
            { label: "Evidence" },
          ]}
        />
        <div className="section-head" style={{ marginTop: 16 }}>
          <div>
            <h1>Evidence packs</h1>
          </div>
        </div>
        <FederationGateHint email={session.email} role={session.role} />
      </div>
    );
  }

  const packs = listEvidencePacks();

  return (
    <div className="container section fed-page">
      <FederationCrumbs
        trail={[
          { href: "/federation", label: "Federation" },
          { label: "Evidence" },
        ]}
      />
      <header className="fed-hub__bar">
        <div>
          <p className="fed-quiz__eyebrow">Footage + markers</p>
          <h1 className="fed-quiz__title">Evidence packs</h1>
          <p className="muted">
            Async packs linked to existing Diveye <code>FootageAsset</code>{" "}
            rows. Open a pack to scrub markers and practice panel tags.
          </p>
        </div>
      </header>
      <FederationSubnav active="evidence" />

      <ul className="fed-case-list">
        {packs.map((p) => (
          <li key={p.id}>
            <Link href={`/federation/evidence/${p.id}`} className="fed-case">
              <div className="fed-case__top">
                <span className="fed-pill">{p.mode}</span>
                <span className="fed-pill">{p.federation}</span>
                <span className="fed-pill">{p.discipline}</span>
              </div>
              <strong className="fed-case__title">
                <Icon name="film" /> {p.title}
              </strong>
              <span className="muted small">
                {p.footageAssetId}
                {p.diveId ? ` · ${p.diveId}` : ""} · {p.markerIds.length}{" "}
                markers ·{" "}
                {p.tags.map((t) => JUDGE_TAG_LABELS[t]).join(", ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
