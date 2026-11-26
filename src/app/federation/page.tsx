import Link from "next/link";
import type { Metadata } from "next";
import {
  FederationCrumbs,
  FederationGateHint,
  FederationSubnav,
} from "@/components/FederationShell";
import { Icon } from "@/components/Icon";
import { canAccessFederation, getSession } from "@/lib/auth";
import {
  listEvidencePacks,
  listMaterials,
  listTrainingCases,
} from "@/lib/federation";

export const metadata: Metadata = {
  title: "Federation judges",
  description:
    "Diveye module 6 — judge training materials, card quizzes, evidence packs.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/federation" },
};

export default async function FederationHubPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="container section">
        <p>
          Sign in required.{" "}
          <Link href="/login?next=/federation">Go to sign in</Link>
        </p>
      </div>
    );
  }

  if (!canAccessFederation(session)) {
    return (
      <div className="container section fed-page">
        <FederationCrumbs trail={[{ label: "Federation" }]} />
        <div className="section-head" style={{ marginTop: 16 }}>
          <div>
            <h1>Federation judges</h1>
            <p>Training materials, borderline card quizzes, evidence packs.</p>
          </div>
        </div>
        <FederationGateHint email={session.email} role={session.role} />
      </div>
    );
  }

  const cases = listTrainingCases();
  const packs = listEvidencePacks();
  const materials = listMaterials();
  const borderline = cases.filter((c) => c.difficulty === "borderline").length;

  return (
    <div className="container section fed-page">
      <FederationCrumbs trail={[{ label: "Federation" }]} />
      <header className="fed-hub__bar">
        <div>
          <p className="fed-quiz__eyebrow">Diveye module 6 · async first</p>
          <h1 className="fed-quiz__title">Federation judges</h1>
          <p className="fed-quiz__meta">
            {session.name} · {session.role}
            {session.role === "admin" ? " (federation admin)" : ""}
          </p>
        </div>
      </header>
      <FederationSubnav active="hub" />

      <div className="fed-hub__stats" aria-label="Catalog summary">
        <div className="fed-stat">
          <strong>{cases.length}</strong>
          <span>Training cases</span>
        </div>
        <div className="fed-stat">
          <strong>{borderline}</strong>
          <span>Borderline</span>
        </div>
        <div className="fed-stat">
          <strong>{packs.length}</strong>
          <span>Evidence packs</span>
        </div>
        <div className="fed-stat">
          <strong>{materials.length}</strong>
          <span>Materials</span>
        </div>
      </div>

      <div className="fed-hub__grid">
        <Link href="/federation/training" className="fed-hub__tile">
          <Icon name="flag" />
          <h2>Training quizzes</h2>
          <p>
            White / yellow / red calls on anonymized cases, scored against
            reference cards and tags.
          </p>
        </Link>
        <Link href="/federation/evidence" className="fed-hub__tile">
          <Icon name="film" />
          <h2>Evidence packs</h2>
          <p>
            Link Diveye FootageAsset clips and markers for async judge panel
            review.
          </p>
        </Link>
      </div>

      <section className="fed-quiz__card" aria-labelledby="fed-mat-h">
        <h2 id="fed-mat-h">Training materials</h2>
        <ul className="fed-mat-list">
          {materials.map((m) => (
            <li key={m.id}>
              <strong>{m.title}</strong>
              <span className="fed-pill">{m.federation}</span>
              <p className="muted">{m.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="caption">
        Out of scope here: AI coach (PWF-21), live on-site panel hardware sync.
      </p>
    </div>
  );
}
