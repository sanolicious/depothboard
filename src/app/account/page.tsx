import Link from "next/link";
import type { Metadata } from "next";
import { ConsentPanel } from "@/components/ConsentPanel";
import { Icon } from "@/components/Icon";
import { LogoutButton } from "@/components/LogoutButton";
import { getSession, ownsAthlete } from "@/lib/auth";
import { claimsForUser, resolveAthleteSlug } from "@/lib/claims";
import { fmtDate, resultDisplay } from "@/lib/format";
import { listOrdersForUser } from "@/lib/orders";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Account",
  description: "Athlete account — appearances, consents, orders and claim status.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

function statusLabel(status: string) {
  switch (status) {
    case "approved":
      return "Approved";
    case "pending":
      return "Under review";
    case "needs_info":
      return "Needs info";
    case "rejected":
      return "Not approved";
    default:
      return status;
  }
}

export default async function AccountPage() {
  const session = await getSession();
  // Middleware should redirect, but keep a safe fallback for RSC.
  if (!session) {
    return (
      <div className="container section">
        <p className="muted">
          Sign in required. <Link href="/login?next=/account">Sign in</Link>
        </p>
      </div>
    );
  }

  const repo = getRepository();
  const db = repo.getDb();
  const claims = claimsForUser(session);
  const athleteSlug = resolveAthleteSlug(session, claims);
  const athlete = athleteSlug
    ? repo.getAthleteBySlug(athleteSlug)
    : undefined;
  const canEditConsents = ownsAthlete(
    { ...session, athleteSlug },
    athlete?.slug,
  );
  const consents = athlete ? repo.listConsents(athlete.slug) : [];

  const performances = athleteSlug
    ? db.performances
        .filter((p) => p.athleteSlug === athleteSlug)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 12)
    : [];

  const orders = listOrdersForUser(session.id);
  const inbox = db.claimsInbox ?? "claims@depthboard.com";

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Account</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Account</h1>
          <p>
            {session.name} · {session.email} · {session.role}
            {athlete ? ` · linked to ${athlete.name}` : " · no claimed athlete yet"}
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-2">
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Profile</h2>
          {athlete ? (
            <>
              <p className="muted small" style={{ marginTop: 8 }}>
                {athlete.name} · {athlete.claimed ? "claimed" : "link pending"} ·{" "}
                {athlete.countryName}
              </p>
              <Link
                className="btn btn--sm"
                href={`/athletes/${athlete.slug}`}
                style={{ marginTop: 14 }}
              >
                View public profile
              </Link>
            </>
          ) : (
            <>
              <p className="muted small" style={{ marginTop: 8 }}>
                No athlete linked. Complete the claim wizard; after steward
                approval your profile appears here.
              </p>
              <Link className="btn btn--sm btn--primary" href="/claim" style={{ marginTop: 14 }}>
                Claim a profile
              </Link>
            </>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Claim status</h2>
          {claims.length === 0 ? (
            <p className="muted small" style={{ marginTop: 8 }}>
              No claims for this account. Steward inbox: {inbox}.
            </p>
          ) : (
            <ul style={{ marginTop: 12, paddingLeft: 18 }}>
              {claims.map((c) => (
                <li key={c.id} className="small" style={{ marginBottom: 10 }}>
                  <strong>{c.athleteName}</strong>
                  <span className="muted">
                    {" "}
                    · {statusLabel(c.status)} · {c.createdAt.slice(0, 10)}
                  </span>
                  {c.notes && (
                    <span className="caption" style={{ display: "block" }}>
                      {c.notes}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link className="btn btn--sm btn--ghost" href="/claim" style={{ marginTop: 8 }}>
            Open claim wizard
          </Link>
        </div>

        <div className="card" style={{ padding: 20, gridColumn: "1 / -1" }}>
          <h2 style={{ fontSize: "1.2rem" }}>My appearances</h2>
          {!athlete ? (
            <p className="muted small" style={{ marginTop: 8 }}>
              Appearances show after an approved claim links your account to an
              athlete.
            </p>
          ) : performances.length === 0 ? (
            <p className="muted small" style={{ marginTop: 8 }}>
              No seed performances for this athlete yet.
            </p>
          ) : (
            <div className="table-scroll" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Disc</th>
                    <th>Result</th>
                    <th>Card</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {performances.map((p) => (
                    <tr key={p.id}>
                      <td className="muted small">{fmtDate(p.date)}</td>
                      <td>{p.eventName}</td>
                      <td>{p.discipline}</td>
                      <td>{resultDisplay(p)}</td>
                      <td>{p.card}</td>
                      <td>
                        <Link className="small" href={`/dives/${p.diveId}`}>
                          Dive
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {athlete && (
          <div style={{ gridColumn: "1 / -1" }}>
            <ConsentPanel
              athleteSlug={athlete.slug}
              athleteName={athlete.name}
              minor={athlete.minor}
              guardianConsentGranted={athlete.guardianConsentGranted}
              seedConsents={consents}
              editable={canEditConsents}
            />
          </div>
        )}

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Orders (stub)</h2>
          {orders.length === 0 ? (
            <p className="muted small" style={{ marginTop: 8 }}>
              No stub orders. Stripe checkout is PWF-15 — cart only for now.
            </p>
          ) : (
            <ul style={{ marginTop: 12, paddingLeft: 18 }}>
              {orders.map((o) => (
                <li key={o.id} className="small" style={{ marginBottom: 10 }}>
                  <strong>{o.id}</strong>
                  <span className="muted">
                    {" "}
                    · {o.status} · €{o.totalEur} · {o.createdAt.slice(0, 10)}
                  </span>
                  <span className="caption" style={{ display: "block" }}>
                    {o.items.map((i) => i.title).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link className="btn btn--sm" href="/cart" style={{ marginTop: 10 }}>
            Open cart
          </Link>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>My library</h2>
          <p className="muted small" style={{ marginTop: 8 }}>
            Purchased clips appear after checkout (PWF-15). Only Diveye-owned
            AIDA titles with consent clear the shop gate.
          </p>
          <Link className="btn btn--sm btn--ghost" href="/shop" style={{ marginTop: 14 }}>
            Browse shop
          </Link>
        </div>
      </div>
    </div>
  );
}
