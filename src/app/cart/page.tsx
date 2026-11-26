import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
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
      <p className="muted">
        Checkout is a stub in MVP — no payment processor yet. The shop lists
        licence plans as coming soon until archive clips are linked.
      </p>
      {items.length === 0 ? (
        <div style={{ marginTop: 28 }}>
          <EmptyState
            icon="cart"
            title="Cart is empty"
            body="Nothing to check out. When Diveye footage licences go on sale, items you add will show up here."
            actionHref="/shop"
            actionLabel="View licence plans"
          />
        </div>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: "minmax(0,1.4fr) minmax(0,0.8fr)",
            gap: 24,
            marginTop: 24,
          }}
        >
          <div className="stack" style={{ gap: 12 }}>
            {items.map((item, idx) => (
              <div className="line-item card" key={idx} style={{ padding: 14 }}>
                <div
                  className="scene"
                  style={
                    {
                      ["--h" as string]: item.scene.h,
                      ["--x" as string]: item.scene.x,
                      ["--d" as string]: item.scene.d,
                    }
                  }
                >
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
          <aside className="card" style={{ padding: 20, height: "fit-content" }}>
            <div className="totals">
              <div className="tr">
                <span>VAT included</span>
                <span>€{vat.toFixed(2)}</span>
              </div>
              <div className="tr big">
                <span>Total</span>
                <span>€{total.toFixed(2)}</span>
              </div>
            </div>
            <button className="btn btn--primary btn--lg btn--block" type="button" disabled>
              Checkout stub
            </button>
            <p className="caption" style={{ marginTop: 12 }}>
              Payments (Stripe / P24) land in a later milestone.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
