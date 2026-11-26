import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Cart",
  description: "Checkout stub for Diveye footage licences.",
  alternates: { canonical: "/cart" },
};

export default function CartPage() {
  const items = getRepository().getDb().cartSeed;
  const total = items.reduce((s, i) => s + i.price, 0);
  const vat = total - total / 1.23;

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <Link href="/shop">Shop</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Cart</span>
      </nav>
      <h1 style={{ marginTop: 16 }}>Your cart</h1>
      <p className="muted">Checkout is a stub in MVP — no payment processor yet.</p>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,0.8fr)", gap: 24, marginTop: 24 }}>
        <div className="stack" style={{ gap: 12 }}>
          {items.map((item, idx) => (
            <div className="line-item card" key={idx} style={{ padding: 14 }}>
              <div className="scene" style={{ ["--h" as string]: item.scene.h, ["--x" as string]: item.scene.x, ["--d" as string]: item.scene.d }}>
                <span className="rope" />
              </div>
              <div>
                <div className="t">{item.title}</div>
                <div className="d">{item.description}</div>
              </div>
              <div className="pr">€{item.price.toFixed(2)}</div>
            </div>
          ))}
        </div>
        <aside className="card" style={{ padding: 20, alignSelf: "start" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: 14 }}>Summary</h2>
          <div className="totals">
            <div className="tr"><span>VAT included</span><span>€{vat.toFixed(2)}</span></div>
            <div className="tr big"><span>Total</span><span>€{total.toFixed(2)}</span></div>
          </div>
          <button className="btn btn--primary btn--lg btn--block" type="button" style={{ marginTop: 16 }} disabled>
            Checkout stub
          </button>
          <div className="pay-methods" style={{ marginTop: 12 }}>
            <span className="pay">Card</span>
            <span className="pay">Apple Pay</span>
            <span className="pay">BLIK</span>
            <span className="pay">Przelewy24</span>
          </div>
          <p className="caption" style={{ marginTop: 12 }}>Sample → personal licence funnel. Commercial add-on later.</p>
        </aside>
      </div>
    </div>
  );
}
