import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { AddToCartButton } from "@/components/AddToCartButton";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Shop",
  description: "Buy Diveye dive clips, event packs and media packs.",
  alternates: { canonical: "/shop" },
};

const PLACEHOLDERS = [
  {
    id: "ph-clip",
    slug: "dive-clip",
    kind: "clip" as const,
    name: "Dive clip · personal licence",
    priceLabel: "from €29",
    description:
      "Social edit (vertical + horizontal) with result overlay, once Diveye OT footage is linked to a performance.",
    delivery: "Delivery within 72 h after competition day · coming with archive",
  },
  {
    id: "ph-pack",
    slug: "event-pack",
    kind: "pack" as const,
    name: "Event pack",
    priceLabel: "from €79",
    description:
      "All of an athlete’s dives from one competition. Pre-order opens per rights-cleared event.",
    delivery: "Bundle unlocks after the event · checkout not open yet",
  },
  {
    id: "ph-media",
    slug: "media-pack",
    kind: "media" as const,
    name: "Media pack",
    priceLabel: "on request",
    description:
      "Broadcast-ready assets for organizers and media. Only for events with a Diveye-owned rights model.",
    delivery: "B2B quote · requires rights + athlete consent",
  },
];

export default function ShopPage() {
  const products = getRepository().listProducts();
  const dives = getRepository().listShowcaseDives();
  const showPlaceholders = products.length === 0;

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
            {showPlaceholders
              ? "Licence plans below are placeholders. Checkout and inventory open when Diveye archive clips are linked — this is not a live store yet."
              : "Sample preview is free. Full clip unlocks after licence purchase (stub checkout)."}
          </p>
        </div>
        <Link className="btn btn--ghost" href="/cart">
          Open cart
        </Link>
      </div>

      {showPlaceholders ? (
        <div className="grid grid-3" style={{ marginBottom: 40 }}>
          {PLACEHOLDERS.map((p) => (
            <div
              key={p.id}
              className="card"
              id={p.slug === "media-pack" ? "media-pack" : undefined}
              style={{ padding: 20 }}
            >
              <div className="row row--between">
                <div className="eyebrow">{p.kind}</div>
                <span className="badge">Coming soon</span>
              </div>
              <h2 style={{ marginTop: 8, fontSize: "1.35rem" }}>{p.name}</h2>
              <div className="price" style={{ margin: "12px 0" }}>
                {p.priceLabel}
              </div>
              <p className="muted small">{p.description}</p>
              <p className="caption" style={{ marginTop: 10 }}>
                {p.delivery}
              </p>
              <div style={{ marginTop: 16 }}>
                <Link className="btn btn--ghost btn--sm" href="/claim">
                  Get notified via claim
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 40 }}>
          {products.map((p) => (
            <div
              key={p.id}
              className="card"
              id={p.slug === "media-pack" ? "media-pack" : undefined}
              style={{ padding: 20 }}
            >
              <div className="eyebrow">{p.kind}</div>
              <h2 style={{ marginTop: 8, fontSize: "1.35rem" }}>{p.name}</h2>
              <div className="price" style={{ margin: "12px 0" }}>
                €{p.price}
              </div>
              <p className="muted small">{p.description}</p>
              <p className="caption" style={{ marginTop: 10 }}>
                {p.delivery}
              </p>
              <div style={{ marginTop: 16 }}>
                <AddToCartButton
                  title={p.name}
                  description={p.description}
                  price={p.price}
                  scene={{ h: 200, x: "50%", d: 0.45 }}
                  label={`Add · €${p.price}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginBottom: 14 }}>Featured dive clips</h2>
      {dives.length === 0 ? (
        <EmptyState
          icon="film"
          title="No clips listed"
          body="When showcase footage is attached to performances, buyable dive pages will appear here. Until then, open any result page for the official score and a clear footage CTA."
          actionHref="/rankings"
          actionLabel="Find athletes"
        />
      ) : (
        <div className="grid grid-3">
          {dives.map((d) => (
            <Link
              key={d.id}
              className="card"
              href={`/dives/${d.id}`}
              style={{ padding: 16 }}
            >
              <div className="row row--between">
                <strong>{d.title}</strong>
                <span className="badge badge--accent">€{d.price}</span>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                {d.markers.length} markers · footage by Diveye
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
