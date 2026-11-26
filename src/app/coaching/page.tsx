import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import {
  COACHING_DISCLAIMER,
  DIVYE_COACHING_COMMISSION_PERCENT,
  listCoachProfiles,
  listPackagesForCoach,
  listSlotsForCoach,
} from "@/lib/coaching-marketplace";

export const metadata: Metadata = {
  title: "Coaching marketplace",
  description:
    "Book Diveye coaching sessions — packages in EUR with seeded availability.",
  alternates: { canonical: "/coaching" },
};

export default function CoachingCatalogPage() {
  const profiles = listCoachProfiles(true);

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Coaching</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Coaching marketplace</h1>
          <p>
            Book remote technique sessions with Diveye coaches. Orientative EUR
            packages · Diveye platform fee{" "}
            <strong>{DIVYE_COACHING_COMMISSION_PERCENT}%</strong> · simulated
            pay in this MVP.
          </p>
        </div>
        <Link className="btn btn--ghost" href="/account">
          My bookings
        </Link>
      </div>

      <p className="coach-disclaimer" role="note">
        <Icon name="info" /> {COACHING_DISCLAIMER}
      </p>

      {profiles.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState
            icon="users"
            title="No coaches listed"
            body="Marketplace seed is empty."
            actionHref="/"
            actionLabel="Home"
          />
        </div>
      ) : (
        <div className="grid grid-2" style={{ marginTop: 24, gap: 16 }}>
          {profiles.map((p) => {
            const pkgs = listPackagesForCoach(p.slug);
            const open = listSlotsForCoach(p.slug, { openOnly: true });
            const from = pkgs.length
              ? Math.min(...pkgs.map((x) => x.priceEur))
              : null;
            return (
              <Link
                key={p.id}
                href={`/coaching/${p.slug}`}
                className="card card--hover"
                style={{ padding: 0, overflow: "hidden", textDecoration: "none" }}
              >
                <div
                  aria-hidden
                  style={{
                    height: 88,
                    background: `linear-gradient(135deg, hsl(${p.photoHue} 42% 28%), hsl(${(p.photoHue + 40) % 360} 35% 16%))`,
                  }}
                />
                <div style={{ padding: 18 }}>
                  <h2 style={{ fontSize: "1.2rem", margin: 0 }}>{p.name}</h2>
                  <p className="muted small" style={{ marginTop: 6 }}>
                    {p.headline}
                  </p>
                  <p className="caption" style={{ marginTop: 10 }}>
                    {p.specialties.join(" · ")} · {p.location}
                  </p>
                  <p className="small" style={{ marginTop: 12 }}>
                    {from != null ? (
                      <>
                        From <strong>€{from}</strong>
                      </>
                    ) : (
                      "Packages TBA"
                    )}
                    <span className="muted">
                      {" "}
                      · {open.length} open slot{open.length === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
