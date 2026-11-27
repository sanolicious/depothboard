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

const PAGE_SIZES = [50, 100, 250, 500] as const;
const DEFAULT_PER = 100;

function one(v: string | string[] | undefined, fallback: string) {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

function parsePer(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (PAGE_SIZES.includes(n as (typeof PAGE_SIZES)[number])) return n;
  if (raw === "all") return 5000;
  return DEFAULT_PER;
}

function parsePage(raw: string, pageCount: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, pageCount));
}

export default async function RankingsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const board = one(sp.board, "PORTAL").toUpperCase() as RankingBoard;
  const sex = one(sp.sex, "M").toUpperCase() as Sex;
  const disc = one(sp.disc, "OVERALL").toUpperCase() as RankingDisc;
  const scope = one(sp.scope, "active").toLowerCase() as RankingScope;
  const q = one(sp.q, "").trim();
  const per = parsePer(one(sp.per, String(DEFAULT_PER)));

  const repo = getRepository();
  const db = repo.getDb();
  let rows = repo.getRanking({
    board: ["PORTAL", "AIDA", "CMAS"].includes(board) ? board : "PORTAL",
    sex: sex === "F" ? "F" : "M",
    disc,
    scope: ["active", "season", "all"].includes(scope) ? scope : "active",
    metric: "points",
  });

  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.athlete.name.toLowerCase().includes(needle) ||
        r.athlete.country.toLowerCase().includes(needle) ||
        r.athlete.slug.toLowerCase().includes(needle),
    );
  }

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / per));
  const page = parsePage(one(sp.page, "1"), pageCount);
  const start = (page - 1) * per;
  const pageRows = rows.slice(start, start + per);
  const showingFrom = total === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + per, total);

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
    const base: Record<string, string> = {
      board,
      sex,
      disc,
      scope,
      per: String(per >= 5000 ? "all" : per),
      page: String(page),
    };
    if (q) base.q = q;
    const next = { ...base, ...patch };
    // Reset to page 1 when filters change (unless page is explicitly patched).
    if (!("page" in patch)) next.page = "1";
    const p = new URLSearchParams(next);
    return `/rankings?${p.toString()}`;
  };

  const boardLabel =
    board === "PORTAL" ? "Portal" : board === "AIDA" ? "AIDA" : "CMAS";
  const scopeLabel =
    scope === "active" ? "Active 24 mo" : scope === "season" ? "Season" : "All-time";

  return (
    <div className="rk-page">
      <div className="rk-hero" aria-hidden="true" />
      <div className="container section rk-shell">
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

        <header className="rk-head">
          <div className="rk-head__copy">
            <p className="eyebrow">Federation-aware boards</p>
            <h1>Rankings</h1>
            <p className="rk-lead">
              Portal OVERALL sums personal bests across eight disciplines with AIDA factors
              (depth ×1, pool dynamic ×0.5, STA ×0.2/s), combining AIDA and CMAS results.
              Separate AIDA-only and CMAS-only boards stay available.
            </p>
          </div>
          <div className="rk-head__meta">
            <div className="rk-stat">
              <span className="rk-stat__k">Athletes on board</span>
              <b className="rk-stat__v num">{total.toLocaleString("en-GB")}</b>
            </div>
            <div className="rk-stat">
              <span className="rk-stat__k">As of</span>
              <b className="rk-stat__v">{fmtDate(db.asOf)}</b>
            </div>
            <div className="rk-stat">
              <span className="rk-stat__k">Window</span>
              <b className="rk-stat__v">{scopeLabel}</b>
            </div>
          </div>
        </header>

        <div className="rk-toolbar">
          <div className="rk-toolbar__row">
            <div className="seg seg--accent" role="group" aria-label="Board">
              {boards.map((b) => (
                <Link
                  key={b}
                  href={qs({ board: b })}
                  aria-current={board === b ? "page" : undefined}
                  className={board === b ? "is-on" : undefined}
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
                  aria-current={sex === s ? "page" : undefined}
                  className={sex === s ? "is-on" : undefined}
                >
                  {s === "M" ? "Men" : "Women"}
                </Link>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Scope">
              {(["active", "season", "all"] as RankingScope[]).map((s) => (
                <Link
                  key={s}
                  href={qs({ scope: s })}
                  aria-current={scope === s ? "page" : undefined}
                  className={scope === s ? "is-on" : undefined}
                >
                  {s === "active" ? "Active" : s === "season" ? "Season" : "All-time"}
                </Link>
              ))}
            </div>
          </div>

          <div className="rk-toolbar__row rk-toolbar__row--disciplines">
            <span className="rk-toolbar__label">Discipline</span>
            <div className="chip-row chip-row--scroll" role="group" aria-label="Discipline">
              {discs.map((d) => (
                <Link
                  key={d}
                  href={qs({ disc: d })}
                  className="chip"
                  aria-pressed={disc === d}
                  aria-current={disc === d ? "page" : undefined}
                >
                  {d}
                </Link>
              ))}
            </div>
          </div>

          <form className="rk-search" role="search" action="/rankings" method="get">
            <input type="hidden" name="board" value={board} />
            <input type="hidden" name="sex" value={sex} />
            <input type="hidden" name="disc" value={disc} />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="per" value={per >= 5000 ? "all" : String(per)} />
            <Icon name="search" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Filter by athlete or country…"
              aria-label="Filter rankings by athlete or country"
            />
            <button className="btn btn--primary btn--sm" type="submit">
              Filter
            </button>
            {q ? (
              <Link className="btn btn--ghost btn--sm" href={qs({ q: "" })}>
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        <div className="rk-board">
          <div className="rk-board__bar">
            <div>
              <h2 className="rk-board__title">
                {boardLabel} · {sex === "M" ? "Men" : "Women"} · {disc}
              </h2>
              <p className="rk-board__sub">
                {total === 0
                  ? "No athletes match this board filter."
                  : `Showing ${showingFrom.toLocaleString("en-GB")}–${showingTo.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")}`}
                {q ? ` · “${q}”` : ""}
              </p>
            </div>
            <div className="rk-per" role="group" aria-label="Rows per page">
              {PAGE_SIZES.map((n) => (
                <Link
                  key={n}
                  href={qs({ per: String(n), page: "1" })}
                  className={per === n ? "is-on" : undefined}
                  aria-current={per === n ? "page" : undefined}
                >
                  {n}
                </Link>
              ))}
              <Link
                href={qs({ per: "all", page: "1" })}
                className={per >= 5000 ? "is-on" : undefined}
                aria-current={per >= 5000 ? "page" : undefined}
              >
                All
              </Link>
            </div>
          </div>

          <div className="rt-wrap rk-table-wrap">
            {pageRows.length === 0 ? (
              <p className="muted" style={{ padding: 28 }}>
                No athletes match this board filter yet.
              </p>
            ) : (
              <table className="rt rk-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th className="l" scope="col">
                      Athlete
                    </th>
                    <th scope="col">Points</th>
                    <th scope="col">% WR</th>
                    <th className="l hide-mobile" scope="col">
                      Disc.
                    </th>
                    <th className="l hide-mobile" scope="col">
                      Best sample
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const sample = Object.entries(row.best).sort(
                      (a, b) => (b[1].points ?? b[1].rp) - (a[1].points ?? a[1].rp),
                    )[0];
                    const posClass =
                      row.pos === 1
                        ? "pos pos--1"
                        : row.pos === 2
                          ? "pos pos--2"
                          : row.pos === 3
                            ? "pos pos--3"
                            : "pos";
                    const wrPct = Math.min(100, Math.max(0, row.pct));
                    return (
                      <tr
                        key={row.athlete.id}
                        className={
                          row.pos <= 3 ? `rk-row rk-row--podium rk-row--${row.pos}` : "rk-row"
                        }
                      >
                        <td className={posClass}>{row.pos}</td>
                        <td className="l">
                          <div className="ath">
                            <CountryChip
                              code={row.athlete.country}
                              neutral={row.athlete.neutral}
                            />
                            <span className="nm">
                              <Link href={`/athletes/${row.athlete.slug}`}>
                                {row.athlete.name}
                              </Link>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="pts">{fmtPoints(row.total)}</span>
                        </td>
                        <td>
                          <div className="rk-wr">
                            <span className="num">{row.pct.toFixed(1)}%</span>
                            <span className="rk-wr__bar" aria-hidden="true">
                              <i style={{ width: `${wrPct}%` }} />
                            </span>
                          </div>
                        </td>
                        <td className="hide-mobile">
                          <span className="rk-count">{row.count}</span>
                        </td>
                        <td className="l hide-mobile">
                          <span className="rk-sample">
                            {sample
                              ? `${sample[0]} ${fmtValue(sample[0], sample[1].rp)} · ${sample[1].federation}`
                              : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {total > 0 ? (
            <nav className="rk-pager" aria-label="Rankings pagination">
              <Link
                className={`btn btn--ghost btn--sm${page <= 1 ? " is-disabled" : ""}`}
                href={page <= 1 ? qs({ page: "1" }) : qs({ page: String(page - 1) })}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
              >
                <Icon name="chev-l" /> Prev
              </Link>
              <div className="rk-pager__pages">
                {pagerWindow(page, pageCount).map((item, idx) =>
                  item === "…" ? (
                    <span key={`e-${idx}`} className="rk-pager__ellipsis">
                      …
                    </span>
                  ) : (
                    <Link
                      key={item}
                      href={qs({ page: String(item) })}
                      className={item === page ? "is-on" : undefined}
                      aria-current={item === page ? "page" : undefined}
                    >
                      {item}
                    </Link>
                  ),
                )}
              </div>
              <Link
                className={`btn btn--ghost btn--sm${page >= pageCount ? " is-disabled" : ""}`}
                href={
                  page >= pageCount
                    ? qs({ page: String(pageCount) })
                    : qs({ page: String(page + 1) })
                }
                aria-disabled={page >= pageCount}
                tabIndex={page >= pageCount ? -1 : undefined}
              >
                Next <Icon name="chev-r" />
              </Link>
            </nav>
          ) : null}
        </div>

        <p className="caption rk-footnote">
          Minors are excluded from public boards by default. Red cards / DQ never enter a PB;
          yellow-card points follow the judging federation&apos;s penalties. Equal points share a
          place (Olympic ranking); ties break on best %WR, then discipline count, then earlier PB
          date.
        </p>
      </div>
    </div>
  );
}

function pagerWindow(page: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (page >= pageCount - 2) {
    set.add(pageCount - 1);
    set.add(pageCount - 2);
    set.add(pageCount - 3);
  }
  const sorted = [...set].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}
