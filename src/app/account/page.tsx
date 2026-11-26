import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Account",
  description: "Mock athlete account panel.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

export default function AccountPage() {
  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Account</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Athlete panel (mock)</h1>
          <p>Signed-in experience is stubbed for MVP.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Profile</h2>
          <p className="muted small" style={{ marginTop: 8 }}>Katarzyna Wiśniewska · claimed mock account</p>
          <Link className="btn btn--sm" href="/athletes/katarzyna-wisniewska" style={{ marginTop: 14 }}>View public profile</Link>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>My library</h2>
          <p className="muted small" style={{ marginTop: 8 }}>Purchased clips will appear here after checkout is wired.</p>
          <Link className="btn btn--sm btn--ghost" href="/shop" style={{ marginTop: 14 }}>Browse shop</Link>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Privacy</h2>
          <p className="muted small" style={{ marginTop: 8 }}>Control ranking visibility and minor guardian settings (future).</p>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.2rem" }}>Orders</h2>
          <p className="muted small" style={{ marginTop: 8 }}>2 items in cart stub · €108.00</p>
          <Link className="btn btn--sm" href="/cart" style={{ marginTop: 14 }}>Open cart</Link>
        </div>
      </div>
    </div>
  );
}
