import Link from "next/link";
import type { Metadata } from "next";
import { CountryChip } from "@/components/CountryChip";
import { Icon } from "@/components/Icon";
import { getRepository } from "@/lib/repository";
import { athleteRank } from "@/lib/ranking";

export const metadata: Metadata = {
  title: "Athletes",
  description: "Browse freediving athletes on Depthboard.",
  alternates: { canonical: "/athletes" },
};

export default function AthletesPage() {
  const repo = getRepository();
  const db = repo.getDb();
  const athletes = repo.listAthletes({ includeMinors: true });

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Athletes</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Athletes</h1>
          <p>Public profiles. Junior athletes are marked and privacy-restricted.</p>
        </div>
      </div>
      <div className="grid grid-2">
        {athletes.map((a) => {
          const rank = athleteRank(db, a);
          return (
            <Link key={a.id} className="card" href={`/athletes/${a.slug}`} style={{ padding: 18 }}>
              <div className="row row--between">
                <div className="row" style={{ gap: 10 }}>
                  <CountryChip code={a.country} neutral={a.neutral} />
                  <strong>{a.name}</strong>
                </div>
                {a.minor ? (
                  <span className="badge">
                    <Icon name="lock" /> Minor
                  </span>
                ) : rank ? (
                  <span className="badge badge--accent">#{rank}</span>
                ) : null}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                {a.countryName}
                {a.club ? ` · ${a.club}` : ""} · {a.sex === "M" ? "Men" : "Women"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
