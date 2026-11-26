import Link from "next/link";
import { Icon } from "@/components/Icon";

export function FederationCrumbs({
  trail,
}: {
  trail: Array<{ href?: string; label: string }>;
}) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      <Icon name="chev-r" />
      {trail.map((item, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="fed-crumb-seg">
            {i > 0 ? <Icon name="chev-r" /> : null}
            {last || !item.href ? (
              <span aria-current={last ? "page" : undefined}>{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function FederationGateHint({
  email,
  role,
}: {
  email: string;
  role: string;
}) {
  return (
    <div className="card fed-gate" style={{ maxWidth: 520 }}>
      <p style={{ marginBottom: 12 }}>
        Judge or federation-admin role required. You are signed in as{" "}
        <strong>{role}</strong> ({email}).
      </p>
      <ul className="muted" style={{ paddingLeft: 18, marginBottom: 16 }}>
        <li>
          <code>judge.demo@example.com</code> / <code>demo</code>
        </li>
        <li>
          <code>admin.demo@example.com</code> / <code>demo</code> (federation
          admin)
        </li>
      </ul>
      <Link className="btn btn--primary" href="/login?next=/federation">
        Switch account
      </Link>
    </div>
  );
}

export function FederationSubnav({ active }: { active: "hub" | "training" | "evidence" }) {
  const items = [
    { key: "hub" as const, href: "/federation", label: "Hub" },
    { key: "training" as const, href: "/federation/training", label: "Training" },
    {
      key: "evidence" as const,
      href: "/federation/evidence",
      label: "Evidence",
    },
  ];
  return (
    <nav className="fed-subnav" aria-label="Federation sections">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={
            active === item.key ? "fed-subnav__link is-active" : "fed-subnav__link"
          }
          aria-current={active === item.key ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
