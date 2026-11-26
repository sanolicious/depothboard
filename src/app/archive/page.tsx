import Link from "next/link";
import type { Metadata } from "next";
import { CardBadge } from "@/components/CardBadge";
import { CountryChip } from "@/components/CountryChip";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { RightsBadge } from "@/components/DiveRightsPanel";
import {
  filterArchiveMoments,
  fmtArchiveClock,
  listArchiveFacets,
  loadArchiveIndex,
} from "@/lib/archive-index";
import { fmtValue } from "@/lib/format";
import { getRepository } from "@/lib/repository";
import { evaluateShowcaseDive, WATERMARK_NOTE } from "@/lib/rights";
import type { ArchiveMoment, ShowcaseDive } from "@/types/domain";

export const metadata: Metadata = {
  title: "Archive / VOD",
  description:
    "Search Diveye archive moments by athlete, discipline, and OT marker — deep-link into the dive player.",
  alternates: { canonical: "/archive" },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

function one(sp: Record<string, string | string[] | undefined>, key: string) {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function archiveHref(opts: {
  q?: string;
  athlete?: string;
  discipline?: string;
  marker?: string;
}) {
  const p = new URLSearchParams();
  if (opts.q?.trim()) p.set("q", opts.q.trim());
  if (opts.athlete?.trim()) p.set("athlete", opts.athlete.trim());
  if (opts.discipline?.trim()) p.set("discipline", opts.discipline.trim());
  if (opts.marker?.trim()) p.set("marker", opts.marker.trim());
  const qs = p.toString();
  return qs ? `/archive?${qs}` : "/archive";
}

export default async function ArchivePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp, "q");
  const athlete = one(sp, "athlete");
  const discipline = one(sp, "discipline");
  const marker = one(sp, "marker");

  const repo = getRepository();
  const db = repo.getDb();
  const index = loadArchiveIndex();
  const facets = listArchiveFacets(index.moments);
  const moments = filterArchiveMoments(index.moments, {
    q,
    athlete,
    discipline,
    marker,
  });

  const filtersActive = Boolean(
    q.trim() || athlete.trim() || discipline.trim() || marker.trim(),
  );

  // Group moments by dive for card grid (primary UI) while keeping moment rows.
  const byDive = new Map<
    string,
    { dive: ShowcaseDive | undefined; moments: ArchiveMoment[] }
  >();
  for (const m of moments) {
    const row = byDive.get(m.diveId) ?? {
      dive: repo.getShowcaseDive(m.diveId),
      moments: [],
    };
    row.moments.push(m);
    byDive.set(m.diveId, row);
  }
  const diveGroups = [...byDive.entries()];

  const search = q ? repo.search(q) : { athletes: [], events: [] };
  const hasIndex = index.moments.length > 0;

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Archive</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Archive / VOD</h1>
          <p>
            AI archive index of Diveye OT markers — filter by athlete,
            discipline, or marker, then open a moment to seek the player (
            <code>?t=</code>).
          </p>
        </div>
      </div>
      <p className="caption" style={{ marginBottom: 12 }}>
        {WATERMARK_NOTE}
      </p>
      <p className="small muted" style={{ marginBottom: 20 }}>
        Index engine: <strong>{index.engine || "—"}</strong>
        {index.asOf ? ` · built ${index.asOf}` : " · not built yet"}
        {hasIndex ? ` · ${index.momentCount} moments` : ""}
        {" · "}
        <code>npm run archive:index</code> or{" "}
        <code>POST /api/archive/index</code>
      </p>

      <form
        className="hero-search"
        action="/archive"
        style={{ maxWidth: 640, marginBottom: 20 }}
      >
        <Icon name="search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search moments… (penalty, protocol, Vitomir)"
          aria-label="Search archive moments"
        />
        {athlete ? <input type="hidden" name="athlete" value={athlete} /> : null}
        {discipline ? (
          <input type="hidden" name="discipline" value={discipline} />
        ) : null}
        {marker ? <input type="hidden" name="marker" value={marker} /> : null}
        <button className="btn btn--primary" type="submit">
          Search
        </button>
      </form>

      {hasIndex ? (
        <div className="filters" style={{ marginBottom: 24 }}>
          <div className="filter-row">
            <span className="filter-label">Athlete</span>
            <div className="chip-row">
              <Link
                className={!athlete ? "chip is-on" : "chip"}
                href={archiveHref({ q, discipline, marker })}
                aria-current={!athlete ? "true" : undefined}
              >
                All
              </Link>
              {facets.athletes.map((a) => (
                <Link
                  key={a.slug}
                  className={athlete === a.slug ? "chip is-on" : "chip"}
                  href={archiveHref({
                    q,
                    athlete: athlete === a.slug ? "" : a.slug,
                    discipline,
                    marker,
                  })}
                  aria-current={athlete === a.slug ? "true" : undefined}
                >
                  {a.name}
                  <span className="muted small"> {a.count}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="filter-row">
            <span className="filter-label">Discipline</span>
            <div className="chip-row">
              <Link
                className={!discipline ? "chip is-on" : "chip"}
                href={archiveHref({ q, athlete, marker })}
                aria-current={!discipline ? "true" : undefined}
              >
                All
              </Link>
              {facets.disciplines.map((d) => (
                <Link
                  key={d.id}
                  className={discipline === d.id ? "chip is-on" : "chip"}
                  href={archiveHref({
                    q,
                    athlete,
                    discipline: discipline === d.id ? "" : d.id,
                    marker,
                  })}
                  aria-current={discipline === d.id ? "true" : undefined}
                >
                  {d.id}
                  <span className="muted small"> {d.count}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="filter-row">
            <span className="filter-label">Marker</span>
            <div className="chip-row">
              <Link
                className={!marker ? "chip is-on" : "chip"}
                href={archiveHref({ q, athlete, discipline })}
                aria-current={!marker ? "true" : undefined}
              >
                All
              </Link>
              {facets.markers.map((m) => (
                <Link
                  key={m.id}
                  className={marker === m.id ? "chip is-on" : "chip"}
                  href={archiveHref({
                    q,
                    athlete,
                    discipline,
                    marker: marker === m.id ? "" : m.id,
                  })}
                  aria-current={marker === m.id ? "true" : undefined}
                >
                  {m.id}
                  <span className="muted small"> {m.count}</span>
                </Link>
              ))}
            </div>
          </div>
          {filtersActive ? (
            <p className="small" style={{ margin: 0 }}>
              <Link href="/archive">Clear filters</Link>
              {" · "}
              {moments.length} moment{moments.length === 1 ? "" : "s"} in{" "}
              {diveGroups.length} dive{diveGroups.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      ) : null}

      {q && (search.athletes.length > 0 || search.events.length > 0) && (
        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <p className="eyebrow">Also matched in results data</p>
          <div className="row row--wrap" style={{ gap: 10, marginTop: 10 }}>
            {search.athletes.map((a) => (
              <Link key={a.id} className="chip" href={`/athletes/${a.slug}`}>
                <CountryChip code={a.country} /> {a.name}
              </Link>
            ))}
            {search.events.map((e) => (
              <Link key={e.id} className="chip" href={`/events/${e.slug}`}>
                {e.shortName}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!hasIndex ? (
        <EmptyState
          icon="film"
          title="Archive index not built yet"
          body="Run npm run archive:index (or POST /api/archive/index) to index FootageAsset markers into searchable moments."
          actionHref="/athletes"
          actionLabel="Browse athletes"
        />
      ) : moments.length === 0 ? (
        <EmptyState
          icon="search"
          title={
            filtersActive
              ? "No moments matched these filters"
              : "No moments to show"
          }
          body="Try marker kinds (penalty, protocol, blackout) or clear athlete/discipline filters."
          actionHref="/archive"
          actionLabel="Clear filters"
        />
      ) : (
        <div className="stack" style={{ gap: 28 }}>
          {diveGroups.map(([diveId, group]) => {
            const showcase = group.dive;
            const first = group.moments[0];
            const athleteRow = repo.getAthleteBySlug(first.athleteSlug);
            const decision = showcase
              ? evaluateShowcaseDive(db, showcase)
              : null;
            const hasFile = Boolean(
              showcase && (showcase.durationSec > 0 || showcase.previewUrl),
            );

            return (
              <section
                key={diveId}
                className="card"
                style={{ padding: 18 }}
                aria-labelledby={`arch-${diveId}`}
              >
                <div
                  className="row row--between row--wrap"
                  style={{ gap: 12, marginBottom: 14 }}
                >
                  <div>
                    <h2
                      id={`arch-${diveId}`}
                      style={{ margin: 0, fontSize: "1.15rem" }}
                    >
                      <Link href={`/dives/${diveId}`}>
                        {first.athleteName} · {first.discipline}
                      </Link>
                    </h2>
                    <p className="meta" style={{ margin: "4px 0 0" }}>
                      {athleteRow ? (
                        <CountryChip code={athleteRow.country} />
                      ) : null}{" "}
                      {first.eventName}
                      {typeof first.rp === "number"
                        ? ` · ${
                            first.card === "R"
                              ? "DQ"
                              : fmtValue(first.discipline, first.rp)
                          }`
                        : ""}
                      {decision?.badge === "embed_only" ? (
                        <>
                          {" · "}
                          <RightsBadge label="CMAS embed" tone="warn" />
                        </>
                      ) : hasFile ? (
                        <>
                          {" · "}
                          <RightsBadge label="AIDA DL" tone="ok" />
                        </>
                      ) : null}
                    </p>
                  </div>
                  {first.card ? <CardBadge card={first.card} /> : null}
                </div>

                <ul
                  className="stack"
                  style={{ gap: 8, listStyle: "none", margin: 0, padding: 0 }}
                >
                  {group.moments.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={m.seekUrl}
                        className="row row--between row--wrap"
                        style={{
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid var(--line-soft)",
                          background: "var(--surface-2)",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <span className="row row--wrap" style={{ gap: 8 }}>
                          <span className="badge">{m.markerKind}</span>
                          <span>
                            <strong>{m.markerLabel}</strong>
                            <span className="muted">
                              {" "}
                              · {fmtArchiveClock(m.atSec)}
                            </span>
                          </span>
                        </span>
                        <span className="small" style={{ maxWidth: 420 }}>
                          {m.summary}{" "}
                          <span className="link-arrow">
                            Seek <Icon name="arrow" />
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
