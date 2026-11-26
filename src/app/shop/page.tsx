import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { AddToCartButton } from "@/components/AddToCartButton";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Shop",
  description: "Buy Diveye dive clips, event packs and media packs.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  const products = getRepository().listProducts();
  const dives = getRepository().listShowcaseDives();

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
          <p>Sample preview is free. Full clip unlocks after licence purchase (stub checkout).</p>
        </div>
        <Link className="btn btn--ghost" href="/cart">Open cart</Link>
      </div>
      <div className="grid grid-3" style={{ marginBottom: 40 }}>
        {products.map((p) => (
          <div key={p.id} className="card" id={p.slug === "media-pack" ? "media-pack" : undefined} style={{ padding: 20 }}>
            <div className="eyebrow">{p.kind}</div>
            <h2 style={{ marginTop: 8, fontSize: "1.35rem" }}>{p.name}</h2>
            <div className="price" style={{ margin: "12px 0" }}>€{p.price}</div>
            <p className="muted small">{p.description}</p>
            <p className="caption" style={{ marginTop: 10 }}>{p.delivery}</p>
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
      <h2 style={{ marginBottom: 14 }}>Featured dive clips</h2>
      <div className="grid grid-3">
        {dives.map((d) => (
          <Link key={d.id} className="card" href={`/dives/${d.id}`} style={{ padding: 16 }}>
            <div className="row row--between">
              <strong>{d.title}</strong>
              <span className="badge badge--accent">€{d.price}</span>
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>{d.markers.length} markers · footage by Diveye</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
