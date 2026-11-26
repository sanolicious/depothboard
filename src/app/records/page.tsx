import Link from "next/link";
import type { Metadata } from "next";
import { CountryChip } from "@/components/CountryChip";
import { Icon } from "@/components/Icon";
import { fmtDate, fmtValue } from "@/lib/format";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Records",
  description: "World records across AIDA and CMAS disciplines.",
  alternates: { canonical: "/records" },
};

export default function RecordsPage() {
  const repo = getRepository();
  const db = repo.getDb();
  const rows = (["M", "F"] as const).flatMap((sex) =>
    db.disciplines.map((d) => {
      const holderPerf = db.performances.find(
        (p) => p.wr && p.discipline === d.code && repo.getAthleteBySlug(p.athleteSlug)?.sex === sex,
      );
      const athlete = holderPerf ? repo.getAthleteBySlug(holderPerf.athleteSlug) : undefined;
      return {
        sex,
        disc: d,
        value: db.wr[sex][d.code],
        athlete,
        perf: holderPerf,
      };
    }),
  );

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Records</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>World records</h1>
          <p>Seed WR table linked to performances when available.</p>
        </div>
      </div>
      <div className="rt-wrap">
        <table className="rt">
          <thead>
            <tr>
              <th>Sex</th>
              <th>Disc</th>
              <th>Record</th>
              <th className="l">Holder</th>
              <th className="l">Event</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.sex}-${r.disc.code}`}>
                <td>{r.sex === "M" ? "Men" : "Women"}</td>
                <td>
                  <span className="badge badge--record">{r.disc.code}</span>
                </td>
                <td className="num">{fmtValue(r.disc.code, r.value)}</td>
                <td className="n">
                  {r.athlete ? (
                    <>
                      <CountryChip code={r.athlete.country} neutral={r.athlete.neutral} />
                      <Link href={`/athletes/${r.athlete.slug}`}>{r.athlete.name}</Link>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{r.perf?.eventName ?? "—"}</td>
                <td>{r.perf ? fmtDate(r.perf.date) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
