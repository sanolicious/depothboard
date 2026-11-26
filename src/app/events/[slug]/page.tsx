import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CardBadge } from "@/components/CardBadge";
import { CountryChip } from "@/components/CountryChip";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { fmtDate, fmtValue, siteUrl } from "@/lib/format";
import { getRepository } from "@/lib/repository";

type Params = Promise<{ slug: string }>;

export const dynamicParams = true;

export async function generateStaticParams() {
  // Pre-render a recent slice; remaining slugs resolve on demand.
  return getRepository()
    .listEvents({ sort: "desc", limit: 120 })
    .map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const ev = getRepository().getEventBySlug(slug);
  if (!ev) return { title: "Event" };
  return {
    title: ev.name,
    description: `${ev.venue} · ${ev.federation} · ${fmtDate(ev.startDate)}`,
    alternates: { canonical: `/events/${ev.slug}` },
  };
}

export default async function EventPage({ params }: { params: Params }) {
  const { slug } = await params;
  const repo = getRepository();
  const ev = repo.getEventBySlug(slug);
  if (!ev) notFound();

  const results = repo.listPerformancesForEvent(ev.id, 48);
  const dives = repo.listShowcaseDives().filter((d) => d.eventId === ev.id);

  return (
    <div className="container section">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: ev.name,
          startDate: ev.startDate,
          endDate: ev.endDate,
          location: {
            "@type": "Place",
            name: ev.venue,
            address: ev.country,
          },
          url: siteUrl(`/events/${ev.slug}`),
          organizer: { "@type": "Organization", name: ev.federation },
        }}
      />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <Link href="/calendar">Events</Link>
        <Icon name="chev-r" />
        <span aria-current="page">{ev.shortName}</span>
      </nav>

      <div className="row row--between row--wrap" style={{ marginTop: 16, gap: 16 }}>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            {ev.status === "live" && (
              <span className="badge badge--live">
                <span className="dot-live" /> LIVE · Day {ev.day}/{ev.ofDays}
              </span>
            )}
            <span className="badge badge--fed">{ev.federation}</span>
            <span className="badge">{ev.type}</span>
          </div>
          <h1>{ev.name}</h1>
          <p className="muted" style={{ marginTop: 10 }}>
            <Icon name="pin" /> {ev.venue}, {ev.country} · {fmtDate(ev.startDate)} –{" "}
            {fmtDate(ev.endDate)}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {ev.liveUrl && (
            <a className="btn btn--primary" href={ev.liveUrl} rel="noopener noreferrer">
              Watch live
            </a>
          )}
          <Link className="btn btn--ghost" href={`/embed/events/${ev.slug}`}>
            Embed
          </Link>
        </div>
      </div>

      {ev.status === "live" && (
        <div className="card" style={{ marginTop: 24, padding: 0, overflow: "hidden" }}>
          <div className="player" style={{ borderRadius: 0, minHeight: 320 }}>
            <div
              className="scene"
              style={
                {
                  ["--h"]: 205,
                  ["--x"]: "48%",
                  ["--d"]: 0.72,
                } as Record<string, string | number>
              }
            >
              <span className="rope" />
              <span className="wm">FOOTAGE BY DIVEYE</span>
            </div>
            <div className="chips">
              <span className="badge badge--live">
                <span className="dot-live" /> LIVE REPLAY
              </span>
            </div>
            <div className="hud">
              <b className="num">110 m</b>Day {ev.day}/{ev.ofDays} · CWT
            </div>
            <div className="ovl">
              {ev.liveUrl ? (
                <a
                  className="btn btn--light"
                  href={ev.liveUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open free live stream
                </a>
              ) : (
                <span className="btn btn--light" aria-disabled>
                  Live stream link pending
                </span>
              )}
            </div>
          </div>
          <div style={{ padding: 14 }} className="small muted">
            Live coverage is free via federation / organizer channels. Diveye
            archives link to OT markers after the day. Rights model: {ev.rightsModel}.
          </div>
        </div>
      )}

      {dives.length > 0 ? (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 14 }}>Dive archive from this event</h2>
          <div className="grid grid-3">
            {dives.map((d) => {
              const a = repo.getAthleteBySlug(d.athleteSlug)!;
              return (
                <Link key={d.id} className="vcard" href={`/dives/${d.id}`}>
                  <div className="vthumb">
                    <div
                      className="scene"
                      style={
                        {
                          "--h": d.scene.h,
                          "--x": d.scene.x,
                          "--d": d.scene.d,
                        } as React.CSSProperties
                      }
                    >
                      <span className="rope" />
                      <span className="wm">DEPTHBOARD</span>
                    </div>
                    <div className="tags">
                      <CardBadge card={d.card} />
                    </div>
                    <span className="res num">
                      {d.card === "R" ? "DQ" : fmtValue(d.discipline, d.rp)}
                    </span>
                  </div>
                  <div className="vbody">
                    <div className="who">
                      <CountryChip code={a.country} /> {a.name}
                    </div>
                    <div className="meta">
                      {d.discipline} · Day {d.day}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <section style={{ marginTop: 32 }}>
          <div className="card" style={{ padding: 20 }}>
            <p className="eyebrow">Footage</p>
            <h2 style={{ fontSize: "1.2rem", marginTop: 6 }}>
              No Diveye archive clips for this event yet
            </h2>
            <p className="muted small" style={{ marginTop: 8, maxWidth: 520 }}>
              Official results below still open dive pages with scores. OT video
              and licences appear when production footage is linked.
            </p>
          </div>
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <div className="section-head">
          <div>
            <h2>Results</h2>
            <p>
              {results.length === 0
                ? "No performances linked to this event in the seed."
                : "Click a row to open the dive / result page."}
            </p>
          </div>
        </div>
        {results.length === 0 ? (
          <p className="muted">Nothing to show for this event.</p>
        ) : (
          <div className="rt-wrap">
            <table className="rt">
              <thead>
                <tr>
                  <th className="l">Athlete</th>
                  <th>Disc</th>
                  <th>AP→RP</th>
                  <th>Card</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => {
                  const a = repo.getAthleteBySlug(p.athleteSlug);
                  if (!a) return null;
                  return (
                    <tr key={p.id}>
                      <td className="n">
                        <CountryChip code={a.country} neutral={a.neutral} />
                        <Link href={`/dives/${p.diveId}`}>{a.name}</Link>
                      </td>
                      <td>{p.discipline}</td>
                      <td className="num">
                        {fmtValue(p.discipline, p.ap)} →{" "}
                        {p.card === "R" ? "DQ" : fmtValue(p.discipline, p.rp)}
                      </td>
                      <td>
                        <CardBadge card={p.card} />
                      </td>
                      <td>
                        <span
                          className={`status ${p.status === "provisional" ? "status--prov" : "status--ok"}`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
