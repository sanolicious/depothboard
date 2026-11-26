import Link from "next/link";
import type { Metadata } from "next";
import { FieldApp, type FieldAthleteRow } from "@/components/FieldApp";
import { Icon } from "@/components/Icon";
import { canAccessField, getSession } from "@/lib/auth";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Field app",
  description:
    "Mobile-first Diveye field operator UI — open sessions, assign dives, offline sync.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/field" },
};

export default async function FieldPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="container section">
        <p>
          Sign in required.{" "}
          <Link href="/login?next=/field">Go to sign in</Link>
        </p>
      </div>
    );
  }

  if (!canAccessField(session)) {
    return (
      <div className="container section field-app-gate">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <Icon name="chev-r" />
          <span aria-current="page">Field</span>
        </nav>
        <div className="section-head" style={{ marginTop: 16 }}>
          <div>
            <h1>Field app</h1>
            <p>
              Operator or admin role required. You are signed in as{" "}
              <strong>{session.role}</strong> ({session.email}).
            </p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 480 }}>
          <p style={{ marginBottom: 12 }}>
            Use a demo operator account:
          </p>
          <ul className="muted" style={{ paddingLeft: 18, marginBottom: 16 }}>
            <li>
              <code>operator.demo@example.com</code> / <code>demo</code>
            </li>
            <li>
              <code>admin.demo@example.com</code> / <code>demo</code>
            </li>
          </ul>
          <Link className="btn btn--primary" href="/login?next=/field">
            Switch account
          </Link>
        </div>
      </div>
    );
  }

  const repo = getRepository();
  const devices = repo.listDevices();
  const seedSessions = repo.listFieldSessions();
  const athletes: FieldAthleteRow[] = repo
    .listAthletes({ includeMinors: true })
    .slice(0, 80)
    .map((a) => {
      const consents = repo.listConsents(a.slug);
      const recording = consents.find((c) => c.purpose === "recording");
      const recordingOk =
        recording?.status === "granted" &&
        (!(a.minor || a.status === "minor") ||
          !!a.guardianConsentGranted ||
          !!recording.guardianConsent);
      return {
        slug: a.slug,
        name: a.name,
        country: a.country,
        minor: a.minor || a.status === "minor",
        recordingConsent: recordingOk,
      };
    });

  return (
    <div className="container section field-app-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Field</span>
      </nav>
      <FieldApp
        operatorName={session.name}
        operatorRole={session.role}
        devices={devices}
        seedSessions={seedSessions}
        athletes={athletes}
      />
    </div>
  );
}
