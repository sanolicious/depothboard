import Link from "next/link";
import type { Metadata } from "next";
import { CountryChip } from "@/components/CountryChip";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { fmtDate, fmtPoints, fmtValue, siteUrl } from "@/lib/format";
import { getRepository } from "@/lib/repository";
import type { RankingBoard, RankingDisc, RankingScope, Sex } from "@/types/domain";

export const metadata: Metadata = {
  title: "Rankings",
  description: "Portal, AIDA and CMAS freediving rankings with transparent methodology.",
  alternates: { canonical: "/rankings" },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined, fallback: string) {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

export default async function RankingsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const board = one(sp.board, "PORTAL").toUpperCase() as RankingBoard;
  const sex = one(sp.sex, "M").toUpperCase() as Sex;
  const disc = one(sp.disc, "OVERALL").toUpperCase() as RankingDisc;
  const scope = one(sp.scope, "active").toLowerCase() as RankingScope;
  const repo = getRepository();
  const db = repo.getDb();
  const rows = repo.getRanking({
    board: ["PORTAL", "AIDA", "CMAS"].includes(board) ? board : "PORTAL",
    sex: sex === "F" ? "F" : "M",
    disc,
    scope: ["active", "season", "all"].includes(scope) ? scope : "active",
    metric: "points",
  });

  const boards: RankingBoard[] = ["PORTAL", "AIDA", "CMAS"];
  const discs: RankingDisc[] = [
    "OVERALL",
    "DEPTH",
    "POOL",
    "CWT",
    "CWTB",
    "CNF",
    "FIM",
    "STA",
    "DYN",
    "DYNB",
    "DNF",
  ];

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({
      board,
      sex,
      disc,
      scope,
      ...patch,
    });
    return `/rankings?${p.toString()}`;
  };

  return (
    <div className="container section">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: `${board} freediving ranking`,
          description: "Active athletes ranking computed from federation results.",
          url: siteUrl("/rankings"),
          creator: { "@type": "Organization", name: "Depthboard" },
          temporalCoverage: db.asOf,
        }}
      />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Rankings</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Federation-aware boards</p>
          <h1>Rankings</h1>
          <p>
            Portal is our combined view. AIDA and CMAS boards only score results judged under
            that federation.
          </p>
        </div>
        <span className="source">
          <Icon name="check-circle" /> As of {fmtDate(db.asOf)}
        </span>
      </div>

      <div className="row row--wrap" style={{ gap: 12, marginBottom: 18 }}>
        <div className="seg" role="group" aria-label="Board">
          {boards.map((b) => (
            <Link
              key={b}
              href={qs({ board: b })}
              className="btn btn--sm"
              aria-current={board === b ? "page" : undefined}
              style={
                board === b
                  ? { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
                  : undefined
              }
            >
              {b === "PORTAL" ? "Portal" : b}
            </Link>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Sex">
          {(["M", "F"] as Sex[]).map((s) => (
            <Link
              key={s}
              href={qs({ sex: s })}
              className="btn btn--sm"
              style={
                sex === s
                  ? { background: "var(--surface-3)", borderColor: "var(--accent)" }
                  : undefined
              }
            >
              {s === "M" ? "Men" : "Women"}
            </Link>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Scope">
          {(["active", "season", "all"] as RankingScope[]).map((s) => (
            <Link key={s} href={qs({ scope: s })} className="btn btn--sm">
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div className="row row--wrap" style={{ gap: 8, marginBottom: 20 }}>
        {discs.map((d) => (
          <Link
            key={d}
            href={qs({ disc: d })}
            className="chip"
            aria-pressed={disc === d}
            style={disc === d ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          >
            {d}
          </Link>
        ))}
      </div>

      <div className="rt-wrap">
        <table className="rt">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th className="l" scope="col">
                Athlete
              </th>
              <th scope="col">Points</th>
              <th scope="col">% WR</th>
              <th className="l hide-mobile" scope="col">
                Best sample
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row) => {
              const sample = Object.entries(row.best)[0];
              return (
                <tr key={row.athlete.id}>
                  <td className="p">{row.pos}</td>
                  <td className="n">
                    <CountryChip code={row.athlete.country} neutral={row.athlete.neutral} />
                    <Link href={`/athletes/${row.athlete.slug}`}>{row.athlete.name}</Link>
                  </td>
                  <td className="num">{fmtPoints(row.total)}</td>
                  <td className="num">{row.pct.toFixed(1)}%</td>
                  <td className="hide-mobile muted small">
                    {sample
                      ? `${sample[0]} ${fmtValue(sample[0], sample[1].rp)} · ${sample[1].federation}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="caption" style={{ marginTop: 12 }}>
        Minors are excluded from public boards by default. Methodology uses discipline factors
        (depth ×1, STA ×0.2, dynamic ×0.5).
      </p>
    </div>
  );
}
