import Link from "next/link";
import { Icon, DiverIcon } from "@/components/Icon";
import { CountryChip } from "@/components/CountryChip";
import { CardBadge } from "@/components/CardBadge";
import { EmptyState } from "@/components/EmptyState";
import { HeroDepthHud } from "@/components/HeroDepthHud";
import { JsonLd } from "@/components/JsonLd";
import { getRepository } from "@/lib/repository";
import { fmtDate, fmtPoints, fmtValue, siteUrl } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Freediving results, records and footage",
  alternates: { canonical: "/" },
};

function sparkPath(form: number[]) {
  const vals = form.slice(-6);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, 1);
  return vals
    .map((v, i) => {
      const x = 2 + (i * 72) / Math.max(vals.length - 1, 1);
      const y = 21 - ((v - min) / span) * 18;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join("");
}

export default function HomePage() {
  const repo = getRepository();
  const db = repo.getDb();
  const men = repo
    .getRanking({
      board: "PORTAL",
      sex: "M",
      disc: "OVERALL",
      scope: "active",
      metric: "points",
    })
    .slice(0, 5);

  const liveEvents = repo.listEvents({ status: "live", limit: 3 });
  const upcomingEvents = repo.listEvents({ status: "upcoming", limit: 3 });
  const happening = [...liveEvents, ...upcomingEvents].slice(0, 3);
  const showingRecent = happening.length === 0;
  const eventCards = showingRecent
    ? repo.listEvents({ sort: "desc", limit: 3 })
    : happening;
  const liveEvent = liveEvents[0];
  const showcase = repo.listShowcaseDives()[0];
  const liveResults = db.liveResults;
  const athleteBySlug = (slug: string) => repo.getAthleteBySlug(slug);

  const recentHighlights = showingRecent
    ? db.performances
        .filter((p) => p.card !== "R")
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.points - a.points)
        .slice(0, 6)
    : [];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Depthboard",
          url: siteUrl(),
          description: db.site.tagline,
          parentOrganization: { "@type": "Organization", name: "Diveye" },
        }}
      />

      <section className="hero" aria-label="Welcome">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="hero-poster"
          src="/video/poster.jpg"
          alt=""
          aria-hidden="true"
        />
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/video/poster.jpg"
          aria-hidden="true"
        >
          <source src="/video/hero.mp4" type="video/mp4" />
        </video>
        <HeroDepthHud />
        <div className="container">
          <div className="hero-in">
            <p className="eyebrow" style={{ color: "#bfe9f0", marginBottom: 16 }}>
              Freediving results, records and footage
            </p>
            <h1>
              Every dive.
              <br />
              <em>Every result.</em>
            </h1>
            <p className="lead">
              Official AIDA and CMAS results, one transparent ranking and every
              dive on video, in one place.
            </p>
            <form className="hero-search" role="search" action="/archive">
              <Icon name="search" />
              <input
                type="search"
                name="q"
                placeholder="Search athletes, events, countries…"
                aria-label="Search athletes, events, countries"
              />
              <button className="btn btn--primary" type="submit">
                Search
              </button>
            </form>
            <div className="hero-cta">
              {liveEvent ? (
                <Link
                  className="btn btn--light btn--lg"
                  href={`/events/${liveEvent.slug}`}
                >
                  <span className="dot-live" aria-hidden="true" /> Watch live
                </Link>
              ) : (
                <Link className="btn btn--light btn--lg" href="/calendar">
                  Browse events
                </Link>
              )}
              <Link
                className="btn btn--ghost btn--lg"
                style={{ background: "rgba(0,0,0,.25)" }}
                href="/rankings"
              >
                Explore rankings
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section--tight" style={{ paddingTop: 0 }} aria-label="Key numbers">
        <div className="container">
          <div className="grid grid-4 keep-2" style={{ gap: 12 }}>
            <div className="stat">
              <b className="num">{db.stats.athletes.toLocaleString("en-GB")}</b>
              <span>athletes</span>
            </div>
            <div className="stat">
              <b className="num">{db.stats.events.toLocaleString("en-GB")}</b>
              <span>events</span>
            </div>
            <div className="stat">
              <b className="num">{db.stats.results.toLocaleString("en-GB")}</b>
              <span>results</span>
            </div>
            <div className="stat">
              <b className="num">{fmtDate(db.stats.asOf)}</b>
              <span>last data update</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "var(--s-6)" }}>
        <div className="container">
          <div className="section-head">
            <div>
              <h2>
                {showingRecent ? "Recent competitions" : "Happening now & next"}
              </h2>
              <p>
                {showingRecent
                  ? "No live or upcoming events in the current seed. Showing the latest ingested competitions."
                  : "Live coverage is free. Results are provisional until the jury confirms them."}
              </p>
            </div>
            <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
              <Link className="link-arrow" href="/calendar">
                All events <Icon name="arrow" />
              </Link>
              <Link className="link-arrow" href="/centers">
                Schools &amp; centers <Icon name="arrow" />
              </Link>
            </div>
          </div>
          {eventCards.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No events yet"
              body="Competition calendar will fill as AIDA and CMAS ingest runs."
              actionHref="/rankings"
              actionLabel="Browse rankings"
            />
          ) : (
            <div className="grid grid-3">
              {eventCards.map((ev) => (
                <Link
                  key={ev.id}
                  className={`event-card${ev.status === "live" ? " event-card--live" : ""}`}
                  href={`/events/${ev.slug}`}
                >
                  <div className="row row--between">
                    {ev.status === "live" ? (
                      <span className="badge badge--live">
                        <span className="dot-live" /> LIVE
                        {ev.day && ev.ofDays
                          ? ` · Day ${ev.day} of ${ev.ofDays}`
                          : ""}
                      </span>
                    ) : ev.status === "upcoming" ? (
                      <span className="badge badge--accent">Upcoming</span>
                    ) : (
                      <span className="badge">Past</span>
                    )}
                    <span
                      className="badge badge--fed"
                      title={`Judged under ${ev.federation} rules`}
                    >
                      {ev.federation}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 14 }}>
                    <span
                      className={`event-mark${ev.status === "live" ? "" : " event-mark--dark"}`}
                    >
                      {ev.federation}
                    </span>
                    <div>
                      <h3>{ev.shortName}</h3>
                      <p className="where">
                        {ev.venue} · {fmtDate(ev.startDate)}
                      </p>
                    </div>
                  </div>
                  <div className="row row--between">
                    <span className="small muted">
                      {ev.disciplines.join(" · ") || ev.type}
                    </span>
                    <span
                      className={`btn btn--sm${ev.status === "live" ? " btn--primary" : ""}`}
                    >
                      {ev.status === "live" ? "Follow live" : "Details"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Top of the board</h2>
              <p>
                Portal Ranking · Overall · Active (rolling 24 months) · AIDA+CMAS
                PBs
              </p>
            </div>
            <Link className="link-arrow" href="/rankings">
              Full ranking <Icon name="arrow" />
            </Link>
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)",
              gap: "var(--s-5)",
              alignItems: "start",
            }}
          >
            <div className="rt-wrap" data-mini>
              <div
                className="row row--between row--wrap"
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                <div className="seg" role="group" aria-label="Gender">
                  <button type="button" aria-pressed="true">
                    Men
                  </button>
                  <Link className="btn btn--sm btn--ghost" href="/rankings?sex=F">
                    Women
                  </Link>
                </div>
                <span className="source">
                  <Icon name="check-circle" /> Updated {fmtDate(db.asOf)}
                </span>
              </div>
              {men.length === 0 ? (
                <div style={{ padding: 24 }}>
                  <p className="muted">Ranking will appear once performances are ingested.</p>
                </div>
              ) : (
                <ol className="mini-list">
                  {men.map((row) => {
                    const d = row.athlete.rankDelta;
                    const path = sparkPath(row.athlete.form);
                    const last = row.athlete.form.slice(-1)[0] ?? 0;
                    const min = Math.min(...row.athlete.form.slice(-6));
                    const max = Math.max(...row.athlete.form.slice(-6));
                    const span = Math.max(max - min, 1);
                    const cy = 21 - ((last - min) / span) * 18;
                    return (
                      <li key={row.athlete.id}>
                        <span className="p">{row.pos}</span>
                        <span className="n">
                          <CountryChip
                            code={row.athlete.country}
                            neutral={row.athlete.neutral}
                          />
                          <Link href={`/athletes/${row.athlete.slug}`}>
                            {row.athlete.name}
                          </Link>
                          <span className="sp">
                            {d > 0 ? (
                              <span
                                className="delta delta--up"
                                aria-label={`Up ${d} places`}
                              >
                                <Icon name="up" />
                                {d}
                              </span>
                            ) : d < 0 ? (
                              <span
                                className="delta delta--down"
                                aria-label={`Down ${-d} places`}
                              >
                                <Icon name="down" />
                                {-d}
                              </span>
                            ) : (
                              <span
                                className="delta delta--flat"
                                aria-label="No change"
                              >
                                –
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="sp">
                          <svg
                            className="spark"
                            viewBox="0 0 76 24"
                            role="img"
                            aria-label="Form trend"
                          >
                            <path d={path} />
                            <circle cx="74" cy={cy} r="2.5" />
                          </svg>
                        </span>
                        <span className="s">
                          {fmtPoints(row.total)}
                          <small>points</small>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="card card--flush">
              {liveResults.length > 0 && liveEvent ? (
                <>
                  <div className="panel-title" style={{ padding: "18px 20px 0" }}>
                    <h3>{liveEvent.shortName}</h3>
                    <span className="status status--prov">Provisional</span>
                  </div>
                  <table className="rs" style={{ marginTop: 6 }}>
                    <thead>
                      <tr>
                        <th className="l" scope="col">
                          #
                        </th>
                        <th className="l" scope="col">
                          Athlete
                        </th>
                        <th scope="col">AP</th>
                        <th scope="col">RP</th>
                        <th scope="col">Card</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveResults.map((r) => {
                        const a = athleteBySlug(r.athleteSlug);
                        if (!a) return null;
                        return (
                          <tr key={r.athleteSlug}>
                            <td className="p">{r.place}</td>
                            <td className="n">
                              <div>
                                <CountryChip code={a.country} />
                                <Link href={`/athletes/${a.slug}`}>
                                  {a.name.split(" ").slice(-1)[0]}
                                </Link>
                                {r.nr && (
                                  <span
                                    className="badge badge--record"
                                    title="National record"
                                  >
                                    NR
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="ap">{r.ap}</td>
                            <td>{r.rp}</td>
                            <td>
                              <CardBadge card={r.card} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div
                    className="row row--between"
                    style={{
                      padding: "14px 20px",
                      borderTop: "1px solid var(--line-soft)",
                    }}
                  >
                    <span className="source">
                      <Icon name="check-circle" /> Live board
                    </span>
                    <Link
                      className="link-arrow"
                      href={`/events/${liveEvent.slug}`}
                    >
                      All results <Icon name="arrow" />
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-title" style={{ padding: "18px 20px 0" }}>
                    <h3>Recent highlights</h3>
                    <span className="status status--ok">Official</span>
                  </div>
                  {recentHighlights.length === 0 ? (
                    <div style={{ padding: 20 }}>
                      <p className="muted small">
                        No live board right now. Check rankings for the latest
                        standings.
                      </p>
                      <Link className="link-arrow" href="/rankings">
                        Open rankings <Icon name="arrow" />
                      </Link>
                    </div>
                  ) : (
                    <table className="rs" style={{ marginTop: 6 }}>
                      <thead>
                        <tr>
                          <th className="l" scope="col">
                            Athlete
                          </th>
                          <th scope="col">Disc</th>
                          <th scope="col">RP</th>
                          <th scope="col">Card</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentHighlights.map((p) => {
                          const a = athleteBySlug(p.athleteSlug);
                          if (!a) return null;
                          return (
                            <tr key={p.id}>
                              <td className="n">
                                <div>
                                  <CountryChip code={a.country} />
                                  <Link href={`/dives/${p.diveId}`}>
                                    {a.name.split(" ").slice(-1)[0]}
                                  </Link>
                                </div>
                              </td>
                              <td>{p.discipline}</td>
                              <td className="num">
                                {fmtValue(p.discipline, p.rp)}
                              </td>
                              <td>
                                <CardBadge card={p.card} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <div
                    className="row row--between"
                    style={{
                      padding: "14px 20px",
                      borderTop: "1px solid var(--line-soft)",
                    }}
                  >
                    <span className="source">
                      <Icon name="check-circle" /> From federation ingest
                    </span>
                    <Link className="link-arrow" href="/calendar">
                      Events <Icon name="arrow" />
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {showcase ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Dive of the day</h2>
                <p>Shareable dive page with markers, cards and buy funnel.</p>
              </div>
              <Link className="link-arrow" href={`/dives/${showcase.id}`}>
                Open dive page <Icon name="arrow" />
              </Link>
            </div>
            <Link className="feature" href={`/dives/${showcase.id}`}>
              <div
                className="scene"
                style={
                  {
                    "--h": showcase.scene.h,
                    "--x": showcase.scene.x,
                    "--d": showcase.scene.d,
                  } as React.CSSProperties
                }
              >
                <span className="rope" />
                <span className="diver" aria-hidden="true">
                  <DiverIcon />
                </span>
                <span className="wm">DEPTHBOARD</span>
              </div>
              <div className="feature-body">
                <span className="eyebrow">Footage by Diveye</span>
                <h3>{showcase.title}</h3>
                <p className="muted">
                  Markers for OT, top, bottom, surface and card — sample →
                  licence funnel.
                </p>
                <span className="btn btn--primary btn--sm">Watch &amp; buy</span>
              </div>
            </Link>
          </div>
        </section>
      ) : (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div>
                <h2>Diveye archive</h2>
                <p>
                  Result pages are live from federation data. Footage markers
                  and licences arrive with the Diveye OT pipeline.
                </p>
              </div>
              <Link className="link-arrow" href="/archive">
                Open archive <Icon name="arrow" />
              </Link>
            </div>
            <EmptyState
              icon="film"
              title="No featured dive footage yet"
              body="Browse athlete results and dive pages for official performances. Sample previews and shop licences will unlock when archive clips are linked."
              actionHref="/athletes"
              actionLabel="Browse athletes"
            />
          </div>
        </section>
      )}
    </>
  );
}
