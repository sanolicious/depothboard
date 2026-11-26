import Link from "next/link";
import type { Metadata } from "next";
import { CountryChip } from "@/components/CountryChip";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { getRepository } from "@/lib/repository";
import { athleteRank } from "@/lib/ranking";

export const metadata: Metadata = {
  title: "Athletes",
  description: "Browse freediving athletes on Depthboard.",
  alternates: { canonical: "/athletes" },
};

const PAGE_SIZE = 48;

type SP = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined, fallback = "") {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

export default async function AthletesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const page = Math.max(1, parseInt(one(sp.page, "1"), 10) || 1);
  const repo = getRepository();
  const db = repo.getDb();
  const all = repo.listAthletes({ q: q || undefined, includeMinors: true });
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const athletes = all.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    Object.entries(patch).forEach(([k, v]) => {
      if (v) p.set(k, v);
      else p.delete(k);
    });
    const s = p.toString();
    return s ? `/athletes?${s}` : "/athletes";
  };

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
          <p>
            Public profiles ({total.toLocaleString("en-GB")}
            {q ? " matching" : ""}). Junior athletes are marked and
            privacy-restricted.
          </p>
        </div>
      </div>

      <form
        className="hero-search"
        action="/athletes"
        style={{ maxWidth: 560, marginBottom: 24 }}
      >
        <Icon name="search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Name or country…"
          aria-label="Search athletes"
        />
        <button className="btn btn--primary" type="submit">
          Search
        </button>
      </form>

      {athletes.length === 0 ? (
        <EmptyState
          icon="user"
          title={q ? `No athletes matched “${q}”` : "No athletes"}
          body="Try another spelling (diacritics are ignored) or open the rankings."
          actionHref="/rankings"
          actionLabel="Open rankings"
        />
      ) : (
        <>
          <div className="grid grid-2">
            {athletes.map((a) => {
              const rank = athleteRank(db, a);
              return (
                <Link
                  key={a.id}
                  className="card"
                  href={`/athletes/${a.slug}`}
                  style={{ padding: 18 }}
                >
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
                    {a.club ? ` · ${a.club}` : ""} ·{" "}
                    {a.sex === "M" ? "Men" : "Women"}
                  </p>
                </Link>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div
              className="row row--between row--wrap"
              style={{ marginTop: 28, gap: 12 }}
            >
              <span className="small muted">
                Page {safePage} of {totalPages}
              </span>
              <div className="row" style={{ gap: 8 }}>
                {safePage > 1 && (
                  <Link
                    className="btn btn--sm btn--ghost"
                    href={qs({ page: String(safePage - 1) })}
                  >
                    Previous
                  </Link>
                )}
                {safePage < totalPages && (
                  <Link
                    className="btn btn--sm"
                    href={qs({ page: String(safePage + 1) })}
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
