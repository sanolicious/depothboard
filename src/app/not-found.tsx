import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container section" style={{ textAlign: "center", paddingBlock: 96 }}>
      <p className="eyebrow">404</p>
      <h1>Depth not found</h1>
      <p className="muted" style={{ margin: "12px auto 24px", maxWidth: 420 }}>
        This page is not in the archive. Try rankings, calendar or the dive shop.
      </p>
      <div className="row" style={{ justifyContent: "center", gap: 10 }}>
        <Link className="btn btn--primary" href="/">Home</Link>
        <Link className="btn btn--ghost" href="/rankings">Rankings</Link>
      </div>
    </div>
  );
}
