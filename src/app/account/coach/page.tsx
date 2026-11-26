import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { getSession, isCoachRole } from "@/lib/auth";
import {
  COACH_DISCLAIMER,
  listCoachLinks,
  listCoachReportsVisibleTo,
} from "@/lib/coach";
import { fmtDate } from "@/lib/format";
import { getRepository } from "@/lib/repository";
import { getUserById } from "@/lib/users";

export const metadata: Metadata = {
  title: "AI coach reports",
  description:
    "Private Diveye AI coach reports — training aid, not medical advice.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/coach" },
};

export default async function AccountCoachPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="container section">
        <p className="muted">
          Sign in required.{" "}
          <Link href="/login?next=/account/coach">Sign in</Link>
        </p>
      </div>
    );
  }

  const repo = getRepository();
  const reports = listCoachReportsVisibleTo(session);
  const coachMode = isCoachRole(session);
  const links = coachMode
    ? listCoachLinks({ coachUserId: session.id, activeOnly: true })
    : [];

  return (
    <div className="container section coach-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <Link href="/account">Account</Link>
        <Icon name="chev-r" />
        <span aria-current="page">AI coach</span>
      </nav>

      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>AI coach</h1>
          <p>
            Private reports for {session.name}
            {coachMode ? " · coach view of assigned athletes" : " · your dives"}
          </p>
        </div>
        <Link className="btn btn--sm" href="/account">
          Back to account
        </Link>
      </div>

      <p className="coach-disclaimer" role="note">
        <Icon name="info" /> {COACH_DISCLAIMER}
      </p>

      {coachMode && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <h2 style={{ fontSize: "1.15rem" }}>Assigned athletes</h2>
          {session.role === "admin" ? (
            <p className="muted small" style={{ marginTop: 8 }}>
              Admin can view any athlete&rsquo;s private coach reports.
            </p>
          ) : links.length === 0 ? (
            <p className="muted small" style={{ marginTop: 8 }}>
              No active coach↔athlete links. Seed assigns Vitomir to{" "}
              <code>coach.demo@example.com</code>.
            </p>
          ) : (
            <ul style={{ marginTop: 12, paddingLeft: 18 }}>
              {links.map((l) => {
                const athlete = repo.getAthleteBySlug(l.athleteSlug);
                return (
                  <li key={l.id} className="small" style={{ marginBottom: 8 }}>
                    <Link href={`/athletes/${l.athleteSlug}`}>
                      {athlete?.name ?? l.athleteSlug}
                    </Link>
                    <span className="muted"> · {l.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <h2 style={{ fontSize: "1.15rem" }}>Reports</h2>
        {reports.length === 0 ? (
          <p className="muted small" style={{ marginTop: 8 }}>
            No reports yet. Open one of your dives and tap{" "}
            <strong>Analyze with AI coach</strong>
            {coachMode
              ? " (athlete must generate; you can then read it here)."
              : "."}
          </p>
        ) : (
          <div className="table-scroll" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Athlete</th>
                  <th>Dive</th>
                  <th>Engine</th>
                  <th>Findings</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const athlete = repo.getAthleteBySlug(r.athleteSlug);
                  const author = getUserById(r.createdByUserId);
                  return (
                    <tr key={r.id}>
                      <td className="muted small">
                        {fmtDate(r.createdAt.slice(0, 10))}
                      </td>
                      <td className="small">
                        {athlete?.name ?? r.athleteSlug}
                      </td>
                      <td className="small">
                        <Link href={`/dives/${r.diveId}`}>{r.diveId}</Link>
                        <div className="caption">
                          by {author?.name ?? r.createdByUserId}
                        </div>
                      </td>
                      <td className="small">
                        <code>{r.engine}</code>
                      </td>
                      <td className="small num">{r.findings.length}</td>
                      <td>
                        <Link className="small" href={`/account/coach/${r.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
