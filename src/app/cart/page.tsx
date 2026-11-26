import Link from "next/link";
import type { Metadata } from "next";
import { CartCheckout } from "@/components/CartCheckout";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Cart",
  description:
    "Checkout Diveye footage licences — simulated pay creates a JSON order.",
  alternates: { canonical: "/cart" },
};

export default async function CartPage() {
  const session = await getSession();

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
        Funnel: free sample → short access → long/watermark → social → HQ/master
        → commercial quote. Guests can add items;{" "}
        {session ? (
          <>
            signed in as <strong>{session.email}</strong> — pay creates a{" "}
            <code>paid_simulated</code> order.
          </>
        ) : (
          <>
            <Link href="/login?next=/cart">sign in</Link> is required to
            checkout.
          </>
        )}
      </p>
      <CartCheckout signedIn={!!session} />
    </div>
  );
}
