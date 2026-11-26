import Link from "next/link";
import type { Metadata } from "next";
import {
  FederationCrumbs,
  FederationGateHint,
  FederationSubnav,
} from "@/components/FederationShell";
import { canAccessFederation, getSession } from "@/lib/auth";
import { listTrainingCases } from "@/lib/federation";

export const metadata: Metadata = {
  title: "Judge training",
  description:
    "Borderline white/yellow/red card quizzes for federation judges.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/federation/training" },
};

export default async function FederationTrainingPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="container section">
        <p>
          Sign in required.{" "}
          <Link href="/login?next=/federation/training">Go to sign in</Link>
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
            { label: "Training" },
          ]}
        />
        <div className="section-head" style={{ marginTop: 16 }}>
          <div>
            <h1>Judge training</h1>
          </div>
        </div>
        <FederationGateHint email={session.email} role={session.role} />
      </div>
    );
  }

  const cases = listTrainingCases();

  return (
    <div className="container section fed-page">
      <FederationCrumbs
        trail={[
          { href: "/federation", label: "Federation" },
          { label: "Training" },
        ]}
      />
      <header className="fed-hub__bar">
        <div>
          <p className="fed-quiz__eyebrow">Async card quizzes</p>
          <h1 className="fed-quiz__title">Judge training</h1>
          <p className="muted">
            {cases.length} anonymized / synthetic cases. Submit a card + tags;
            score vs seed reference (70% card, 30% tag F1).
          </p>
        </div>
      </header>
      <FederationSubnav active="training" />

      <ul className="fed-case-list">
        {cases.map((c) => (
          <li key={c.id}>
            <Link href={`/federation/training/${c.id}`} className="fed-case">
              <div className="fed-case__top">
                <span className={`fed-diff fed-diff--${c.difficulty}`}>
                  {c.difficulty}
                </span>
                <span className="fed-pill">{c.federation}</span>
                <span className="fed-pill">{c.discipline}</span>
                <span className="fed-pill">async</span>
              </div>
              <strong className="fed-case__title">{c.title}</strong>
              <span className="muted small">
                {c.anonymizedAthlete} · {c.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
