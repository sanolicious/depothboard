import Link from "next/link";
import type { Metadata } from "next";
import { ClaimWizard } from "@/components/ClaimWizard";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Claim your profile",
  description: "Request to claim an athlete profile on Depthboard.",
  alternates: { canonical: "/claim" },
};

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const repo = getRepository();
  const db = repo.getDb();
  const inbox = db.claimsInbox ?? "claims@depthboard.com";

  const rankingHints = new Map<string, string>();
  for (const sex of ["M", "F"] as const) {
    repo
      .getRanking({
        board: "PORTAL",
        sex,
        disc: "OVERALL",
        scope: "active",
        metric: "points",
      })
      .slice(0, 80)
      .forEach((r) => {
        rankingHints.set(
          r.athlete.slug,
          `Portal #${r.pos} · ${r.count} results · ${Math.round(r.total)} pts`,
        );
      });
  }

  const athleteCatalog = repo
    .listAthletes({ includeMinors: true })
    .slice(0, 400)
    .map((a) => ({
      slug: a.slug,
      name: a.name,
      country: a.country,
      countryName: a.countryName,
      claimed: a.claimed,
      minor: a.minor,
      hint: rankingHints.get(a.slug) ?? `${a.countryName} · ${a.status}`,
    }));

  // Ensure preselected slug is in catalog even if outside top slice
  if (params.slug && !athleteCatalog.some((a) => a.slug === params.slug)) {
    const a = repo.getAthleteBySlug(params.slug);
    if (a) {
      athleteCatalog.unshift({
        slug: a.slug,
        name: a.name,
        country: a.country,
        countryName: a.countryName,
        claimed: a.claimed,
        minor: a.minor,
        hint: rankingHints.get(a.slug) ?? `${a.countryName} · ${a.status}`,
      });
    }
  }

  const myClaims = session
    ? repo
        .listClaimRequests()
        .filter(
          (c) =>
            c.userId === session.id ||
            c.email.toLowerCase() === session.email.toLowerCase(),
        )
        .slice(-5)
        .reverse()
    : [];

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Claim</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Claim your profile</h1>
          <p>
            Four-step wizard → pending claim logged locally and mailed to{" "}
            {inbox}. Steward approves by hand; then the athlete shows on your
            account.
          </p>
        </div>
      </div>

      <ClaimWizard
        inbox={inbox}
        session={session}
        initialSlug={params.slug}
        athleteCatalog={athleteCatalog}
      />

      {myClaims.length > 0 && (
        <div className="card" style={{ padding: 20, marginTop: 28, maxWidth: 720 }}>
          <h2 style={{ fontSize: "1.1rem" }}>Your claim status</h2>
          <ul style={{ marginTop: 12, paddingLeft: 18 }}>
            {myClaims.map((c) => (
              <li key={c.id} className="small muted" style={{ marginBottom: 8 }}>
                <strong style={{ color: "var(--text)" }}>{c.athleteName}</strong>{" "}
                · {c.status} · {c.createdAt.slice(0, 10)}
                {c.guardian ? " · guardian" : ""}
                {c.id ? ` · ${c.id}` : ""}
              </li>
            ))}
          </ul>
          <Link className="btn btn--sm btn--ghost" href="/account" style={{ marginTop: 8 }}>
            View in account
          </Link>
        </div>
      )}
    </div>
  );
}
