import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { ShopProductCard } from "@/components/ShopProductCard";
import { RightsBadge } from "@/components/DiveRightsPanel";
import { getRepository } from "@/lib/repository";
import {
  evaluateShowcaseDive,
  getRecordingRights,
  hasConsent,
  WATERMARK_NOTE,
} from "@/lib/rights";

export const metadata: Metadata = {
  title: "Shop",
  description: "Buy Diveye dive clips, event packs and media packs.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  const repo = getRepository();
  const db = repo.getDb();
  const products = repo.listProducts();
  const dives = repo.listShowcaseDives();

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Shop</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Footage shop</h1>
          <p>
            Products stay unavailable without athlete consent or when the event
            is CMAS embed-only. AIDA Diveye-owned clips can be licensed
            (checkout still stubbed).
          </p>
        </div>
        <Link className="btn btn--ghost" href="/cart">
          Open cart
        </Link>
      </div>

      <p className="caption" style={{ marginBottom: 24 }}>
        {WATERMARK_NOTE}
      </p>

      {products.length === 0 ? (
        <EmptyState
          icon="film"
          title="No products yet"
          body="Licence inventory appears when rights-cleared Diveye clips are linked."
          actionHref="/claim"
          actionLabel="Claim profile"
        />
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 40 }}>
          {products.map((p) => {
            const dive = p.diveId
              ? dives.find((d) => d.id === p.diveId)
              : undefined;
            const rights = p.diveId
              ? getRecordingRights(db, p.diveId)
              : undefined;
            const athlete = dive
              ? repo.getAthleteBySlug(dive.athleteSlug)
              : undefined;
            return (
              <ShopProductCard
                key={p.id}
                product={p}
                flags={{
                  athleteSlug: dive?.athleteSlug,
                  recording: dive
                    ? hasConsent(db, dive.athleteSlug, "recording")
                    : true,
                  publication: dive
                    ? hasConsent(db, dive.athleteSlug, "publication")
                    : true,
                  commercial: dive
                    ? hasConsent(db, dive.athleteSlug, "commercial")
                    : true,
                  minor: !!athlete?.minor,
                  guardianOk: !!athlete?.guardianConsentGranted,
                  embedOnly: !!rights?.embedOnly,
                  rightsSaleEnabled: rights ? rights.saleEnabled : true,
                  blockReason: rights?.blockReason,
                  maxTier: rights?.maxLicenseTier,
                }}
              />
            );
          })}
        </div>
      )}

      <h2 style={{ marginBottom: 14 }}>Featured dive clips</h2>
      {dives.length === 0 ? (
        <EmptyState
          icon="film"
          title="No clips listed"
          body="When showcase footage is attached to performances, buyable dive pages will appear here."
          actionHref="/rankings"
          actionLabel="Find athletes"
        />
      ) : (
        <div className="grid grid-3">
          {dives.map((d) => {
            const decision = evaluateShowcaseDive(db, d);
            return (
              <Link
                key={d.id}
                className="card"
                href={`/dives/${d.id}`}
                style={{ padding: 16, opacity: decision.allowed ? 1 : 0.75 }}
              >
                <div className="row row--between row--wrap" style={{ gap: 8 }}>
                  <strong>{d.title}</strong>
                  {decision.allowed ? (
                    <span className="badge badge--accent">€{d.price}</span>
                  ) : (
                    <RightsBadge
                      label={
                        decision.badge === "embed_only"
                          ? "CMAS embed-only"
                          : "Unavailable"
                      }
                      tone="warn"
                    />
                  )}
                </div>
                <p className="small muted" style={{ marginTop: 8 }}>
                  {decision.allowed
                    ? `${d.markers.length} markers · Diveye-owned`
                    : decision.message}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
