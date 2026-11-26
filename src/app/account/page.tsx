import Link from "next/link";
import type { Metadata } from "next";
import { ClearCartOnCheckoutSuccess } from "@/components/ClearCartOnCheckoutSuccess";
import { ConsentPanel } from "@/components/ConsentPanel";
import { Icon } from "@/components/Icon";
import { LogoutButton } from "@/components/LogoutButton";
import { getSession, ownsAthlete } from "@/lib/auth";
import { claimsForUser, resolveAthleteSlug } from "@/lib/claims";
import { fmtDate, resultDisplay } from "@/lib/format";
import {
  deliveryKindLabel,
  isPaidStatus,
  listOrdersForUser,
} from "@/lib/orders";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Account",
  description: "Athlete account — appearances, consents, orders and claim status.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

type Search = Promise<{ order?: string; checkout?: string }>;

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

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Search;
}) {
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

  const params = (await searchParams) ?? {};
  const highlightOrderId = params.order;
  const checkoutState = params.checkout;
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
  const myAssignments = athleteSlug
    ? repo.listDiveAssignments({ athleteSlug })
    : [];
  const mySessionIds = [...new Set(myAssignments.map((a) => a.fieldSessionId))];
  const mySessions = mySessionIds
    .map((sid) => repo.getFieldSession(sid))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const performances = athleteSlug
    ? db.performances
        .filter((p) => p.athleteSlug === athleteSlug)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 12)
    : [];

  const orders = listOrdersForUser(session.id);
  const libraryItems = orders
    .filter((o) => isPaidStatus(o.status))
    .flatMap((o) =>
      o.items.map((item) => ({
        orderId: o.id,
        createdAt: o.createdAt,
        ...item,
      })),
    );
  const inbox = db.claimsInbox ?? "claims@depthboard.com";

  return (
    <div className="container section">
      <ClearCartOnCheckoutSuccess checkout={checkoutState} />
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
              <div className="row row--wrap" style={{ gap: 8, marginTop: 14 }}>
                <Link className="btn btn--sm" href={`/athletes/${athlete.slug}`}>
                  View public profile
                </Link>
                <Link className="btn btn--sm btn--primary" href="/account/coach">
                  AI coach reports
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="muted small" style={{ marginTop: 8 }}>
                No athlete linked. Complete the claim wizard; after steward
                approval your profile appears here. Coaches use{" "}
                <Link href="/account/coach">/account/coach</Link>.
              </p>
              <div className="row row--wrap" style={{ gap: 8, marginTop: 14 }}>
                <Link className="btn btn--sm btn--primary" href="/claim">
                  Claim a profile
                </Link>
                <Link className="btn btn--sm" href="/account/coach">
                  AI coach
                </Link>
              </div>
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

        {athlete && mySessions.length > 0 && (
          <div className="card" style={{ padding: 20, gridColumn: "1 / -1" }}>
            <h2 style={{ fontSize: "1.2rem" }}>Field sessions</h2>
            <p className="muted small" style={{ marginTop: 8 }}>
              Read-only assignments from ecosystem hooks (device ↔ dive). Admin
              fleet view: <Link href="/devices">/devices</Link>.
            </p>
            <ul style={{ marginTop: 12, paddingLeft: 18 }}>
              {mySessions.map((s) => (
                <li key={s.id} className="small" style={{ marginBottom: 8 }}>
                  <Link href={`/sessions/${s.id}`}>{s.label}</Link>
                  <span className="muted">
                    {" "}
                    · {s.kind} · {s.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

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

        <div className="card" style={{ padding: 20, gridColumn: "1 / -1" }}>
          <h2 style={{ fontSize: "1.2rem" }}>Orders</h2>
          {checkoutState === "success" && (
            <p className="caption" style={{ marginTop: 8 }}>
              Stripe Checkout completed. If the order still shows{" "}
              <code>pending</code>, wait a moment for the webhook — entitlements
              appear once status is <code>paid</code>.
            </p>
          )}
          {checkoutState === "cancelled" && (
            <p className="caption" style={{ marginTop: 8 }}>
              Stripe Checkout was cancelled.{" "}
              <Link href="/cart">Return to cart</Link> to try again.
            </p>
          )}
          {highlightOrderId && (
            <p className="caption" style={{ marginTop: 8 }}>
              Highlighting order <code>{highlightOrderId}</code> from checkout.
            </p>
          )}
          {orders.length === 0 ? (
            <p className="muted small" style={{ marginTop: 8 }}>
              No orders yet. Add a clip in the shop and pay from the cart while
              signed in (Stripe when keys are set, otherwise simulated).
            </p>
          ) : (
            <div className="table-scroll" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Items / delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      style={
                        o.id === highlightOrderId
                          ? { background: "rgba(80, 160, 180, 0.12)" }
                          : undefined
                      }
                    >
                      <td>
                        <strong className="small">{o.id}</strong>
                        <div className="caption">{o.createdAt.slice(0, 10)}</div>
                      </td>
                      <td className="small">
                        <code>{o.status}</code>
                      </td>
                      <td className="small">€{o.totalEur}</td>
                      <td className="small">
                        {o.items.map((i, idx) => (
                          <div key={idx} style={{ marginBottom: 8 }}>
                            <strong>{i.title}</strong>
                            <span className="muted">
                              {" "}
                              · {i.licenseTier ?? "licence"} ·{" "}
                              {deliveryKindLabel(i.delivery?.kind)}
                            </span>
                            {i.delivery?.note && (
                              <span
                                className="caption"
                                style={{ display: "block" }}
                              >
                                {i.delivery.note}
                              </span>
                            )}
                            <span style={{ display: "block", marginTop: 4 }}>
                              {i.delivery?.downloadUrl && (
                                <a href={i.delivery.downloadUrl} download>
                                  Download
                                </a>
                              )}
                              {i.delivery?.downloadUrl &&
                                i.delivery?.streamUrl &&
                                " · "}
                              {i.delivery?.streamUrl && (
                                <a href={i.delivery.streamUrl}>Stream</a>
                              )}
                              {i.delivery?.status === "processing" && (
                                <span className="muted">
                                  Processing — email when ready
                                </span>
                              )}
                              {i.delivery?.status === "quote_pending" && (
                                <span className="muted">Quote pending</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link className="btn btn--sm" href="/cart" style={{ marginTop: 10 }}>
            Open cart
          </Link>
        </div>

        <div className="card" style={{ padding: 20, gridColumn: "1 / -1" }}>
          <h2 style={{ fontSize: "1.2rem" }}>My library</h2>
          {libraryItems.length === 0 ? (
            <p className="muted small" style={{ marginTop: 8 }}>
              Purchased sample/social placeholders and HQ processing rows appear
              here after paid checkout (Stripe or simulated).
            </p>
          ) : (
            <ul style={{ marginTop: 12, paddingLeft: 18 }}>
              {libraryItems.map((item, idx) => (
                <li key={`${item.orderId}-${idx}`} className="small" style={{ marginBottom: 10 }}>
                  <strong>{item.title}</strong>
                  <span className="muted">
                    {" "}
                    · {item.licenseTier} · order {item.orderId}
                  </span>
                  {item.delivery?.downloadUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={item.delivery.downloadUrl} download>
                        Download
                      </a>
                    </>
                  )}
                  {item.delivery?.streamUrl && (
                    <>
                      {" "}
                      · <a href={item.delivery.streamUrl}>Stream</a>
                    </>
                  )}
                  {item.delivery?.status === "processing" && (
                    <span className="caption" style={{ display: "block" }}>
                      HQ processing — email when montage is ready
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link className="btn btn--sm btn--ghost" href="/shop" style={{ marginTop: 14 }}>
            Browse shop
          </Link>
        </div>
      </div>
    </div>
  );
}
