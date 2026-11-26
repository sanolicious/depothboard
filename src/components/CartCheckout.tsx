"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import {
  CART_EVENT,
  cartTotal,
  clearCart,
  readCart,
  removeFromCart,
  vatIncluded,
} from "@/lib/cart";
import type { CartLine, Order } from "@/types/domain";

export function CartCheckout({ signedIn }: { signedIn: boolean }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const sync = () => setCart(readCart());
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const total = cartTotal(cart);
  const vat = vatIncluded(total);

  async function paySimulated() {
    setError(null);
    if (!signedIn) {
      setError("Sign in required to checkout. Guests may keep items in the cart.");
      return;
    }
    if (!cart.length) {
      setError("Cart is empty.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        loginRequired?: boolean;
        order?: Order;
        redirect?: string;
      };
      if (!res.ok || !data.ok || !data.order) {
        if (data.loginRequired || res.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent("/cart")}`;
          return;
        }
        setError(data.error || "Checkout failed");
        return;
      }
      clearCart();
      setCart([]);
      setOrder(data.order);
    } catch {
      setError("Network error during checkout");
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <h2 style={{ fontSize: "1.35rem" }}>Payment simulated</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Order <strong>{order.id}</strong> · status{" "}
          <code>{order.status}</code> · €{order.totalEur.toFixed(2)}
        </p>
        <ul style={{ marginTop: 16, paddingLeft: 18 }}>
          {order.items.map((item, i) => (
            <li key={i} className="small" style={{ marginBottom: 12 }}>
              <strong>{item.title}</strong>
              <span className="muted">
                {" "}
                · {item.licenseTier ?? "licence"} · €{item.priceEur}
              </span>
              {item.delivery && (
                <span className="caption" style={{ display: "block" }}>
                  {item.delivery.note}
                  {item.delivery.downloadUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={item.delivery.downloadUrl} download>
                        Download placeholder
                      </a>
                    </>
                  )}
                  {item.delivery.streamUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={item.delivery.streamUrl}>
                        Watermarked stream
                      </a>
                    </>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="row row--wrap" style={{ gap: 10, marginTop: 18 }}>
          <Link className="btn btn--primary" href={`/account?order=${order.id}`}>
            View in account
          </Link>
          <Link className="btn btn--ghost" href="/shop">
            Back to shop
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div style={{ marginTop: 28 }}>
        <EmptyState
          icon="cart"
          title="Cart is empty"
          body="Add a Diveye AIDA clip from the shop (sample → short → watermark → social → HQ). Guests can cart; checkout needs login."
          actionHref="/shop"
          actionLabel="Browse shop"
        />
      </div>
    );
  }

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: "minmax(0,1.4fr) minmax(0,0.8fr)",
        gap: 24,
        marginTop: 24,
      }}
    >
      <div className="stack" style={{ gap: 12 }}>
        {cart.map((item, idx) => (
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
              <div className="d">
                {item.description}
                {item.licenseTier ? ` · ${item.licenseTier}` : ""}
              </div>
              <button
                className="rm"
                type="button"
                onClick={() => setCart(removeFromCart(idx))}
              >
                Remove
              </button>
            </div>
            <div className="pr">
              {item.price > 0 ? `€${item.price.toFixed(2)}` : "Free"}
            </div>
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
        {signedIn ? (
          <button
            className="btn btn--primary btn--lg btn--block"
            type="button"
            disabled={busy}
            onClick={() => void paySimulated()}
          >
            <Icon name="cart" />
            {busy ? "Processing…" : `Pay (simulated) · €${total.toFixed(2)}`}
          </button>
        ) : (
          <>
            <Link
              className="btn btn--primary btn--lg btn--block"
              href={`/login?next=${encodeURIComponent("/cart")}`}
            >
              Sign in to checkout
            </Link>
            <p className="caption" style={{ marginTop: 12 }}>
              Guests may keep items in the cart. Demo login password:{" "}
              <code>demo</code>.
            </p>
          </>
        )}
        {error && (
          <p className="caption" style={{ marginTop: 12, color: "#e8a070" }}>
            {error}
          </p>
        )}
        <p className="caption" style={{ marginTop: 12 }}>
          Creates an Order in JSON with status <code>paid_simulated</code>.
          Stripe hooks documented for later — no live keys required.
        </p>
      </aside>
    </div>
  );
}
