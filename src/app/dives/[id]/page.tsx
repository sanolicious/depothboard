import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CardBadge } from "@/components/CardBadge";
import { CountryChip } from "@/components/CountryChip";
import { DiverIcon, Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { AddToCartButton } from "@/components/AddToCartButton";
import { resolveDive } from "@/lib/dives";
import { fmtDate, fmtDuration, fmtValue, siteUrl } from "@/lib/format";
import { getRepository } from "@/lib/repository";

type Params = Promise<{ id: string }>;

export const dynamicParams = true;

export async function generateStaticParams() {
  return getRepository()
    .listShowcaseDives()
    .map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const dive = resolveDive(getRepository(), id);
  if (!dive) return { title: "Dive" };
  return {
    title: dive.title,
    description: dive.hasVideo
      ? `Dive page with markers, cards and footage · ${dive.discipline}`
      : `Official result · ${dive.discipline} · footage pending`,
    alternates: { canonical: `/dives/${dive.id}` },
    openGraph: {
      title: dive.title,
      url: siteUrl(`/dives/${dive.id}`),
      type: dive.hasVideo ? "video.other" : "website",
    },
  };
}

export default async function DivePage({ params }: { params: Params }) {
  const { id } = await params;
  const repo = getRepository();
  const dive = resolveDive(repo, id);
  if (!dive) notFound();
  const athlete = repo.getAthleteBySlug(dive.athleteSlug);
  const event = repo.getEventById(dive.eventId);
  if (!athlete || !event) notFound();
  const wr = repo.getDb().wr[athlete.sex][dive.discipline];
  const pct = dive.card === "R" || !wr ? 0 : (dive.rp / wr) * 100;
  const others = repo
    .listShowcaseDives()
    .filter((d) => d.id !== dive.id && d.eventId === dive.eventId)
    .slice(0, 6);
  const relatedPerformances =
    others.length > 0
      ? []
      : repo
          .listPerformancesForEvent(dive.eventId, 6)
          .filter((p) => p.diveId !== dive.id);

  const annotClass =
    dive.annotation.type === "penalty"
      ? "annot--y"
      : dive.annotation.type === "dq"
        ? "annot--r"
        : "annot--w";

  return (
    <div className="container section">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": dive.hasVideo ? "VideoObject" : "SportsEvent",
          name: dive.title,
          description: dive.annotation.text,
          ...(dive.hasVideo
            ? {
                uploadDate: dive.date,
                duration: `PT${Math.max(dive.durationSec, 1)}S`,
              }
            : {
                startDate: dive.date,
              }),
          url: siteUrl(`/dives/${dive.id}`),
        }}
      />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <Link href="/calendar">Events</Link>
        <Icon name="chev-r" />
        <Link href={`/events/${event.slug}`}>{event.shortName}</Link>
        <Icon name="chev-r" />
        <span aria-current="page">
          Day {dive.day} · {dive.discipline}
        </span>
      </nav>

      <div className="dive-grid" style={{ marginTop: "var(--s-3)" }}>
        <div className="stack" style={{ gap: "var(--s-5)" }}>
          <div>
            <div className="player">
              <div
                className="scene"
                style={
                  {
                    "--h": dive.scene.h,
                    "--x": dive.scene.x,
                    "--d": dive.scene.d,
                  } as React.CSSProperties
                }
              >
                <span className="rope" />
                <span className="diver" aria-hidden="true">
                  <DiverIcon />
                </span>
                <span className="wm">DEPTHBOARD</span>
              </div>
              <div className="chips">
                {dive.hasVideo ? (
                  <span className="badge" style={{ background: "rgba(0,0,0,.55)" }}>
                    Preview · 20 s
                  </span>
                ) : (
                  <span className="badge" style={{ background: "rgba(0,0,0,.55)" }}>
                    Result only · no footage yet
                  </span>
                )}
              </div>
              <div className="hud">
                <b className="num">
                  {dive.card === "R" ? "DQ" : fmtValue(dive.discipline, dive.rp)}
                </b>
                OT {dive.ot} · {dive.discipline}
              </div>
              <div className="ovl">
                {dive.hasVideo ? (
                  <button className="bigplay" type="button" aria-label="Play preview">
                    <Icon name="play" filled />
                  </button>
                ) : (
                  <div
                    className="card"
                    style={{
                      padding: 18,
                      maxWidth: 360,
                      textAlign: "center",
                      background: "rgba(8,16,22,.88)",
                    }}
                  >
                    <p style={{ marginBottom: 12, color: "#e8f4f7" }}>
                      Diveye footage is not linked for this performance yet.
                    </p>
                    <Link className="btn btn--light btn--sm" href="/archive">
                      Browse archive status
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <div
              className="player-bar"
              style={{
                border: "1px solid var(--line-soft)",
                borderTop: 0,
                borderRadius: "0 0 var(--r-lg) var(--r-lg)",
              }}
            >
              {dive.hasVideo && dive.markers.length > 0 ? (
                <div className="timeline" aria-label="Dive timeline">
                  <div className="track" />
                  <div className="prog" style={{ width: "42%" }} />
                  <div className="head" style={{ left: "42%" }} />
                  {dive.markers.map((m) => (
                    <div
                      key={m.id}
                      className={`mk${m.kind === "card" ? " mk--card" : ""}${m.kind === "penalty" || m.kind === "bo" ? " mk--warn" : ""}`}
                      style={{ left: `${m.at * 100}%` }}
                    >
                      <i />
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "12px 14px" }} className="small muted">
                  OT markers appear when Diveye archive footage is attached to
                  this dive.
                </div>
              )}
              <div className="cams" role="group" aria-label="Camera">
                {dive.cameras.length > 0 ? (
                  dive.cameras.map((c, i) => (
                    <button
                      key={c}
                      className="chip"
                      type="button"
                      aria-pressed={i === 0}
                    >
                      {i === 0 && <Icon name="camera" />} {c}
                    </button>
                  ))
                ) : (
                  <span className="chip" aria-disabled>
                    Cameras pending
                  </span>
                )}
                <span className="source" style={{ marginLeft: "auto" }}>
                  {dive.hasVideo ? "Footage by Diveye" : "Result from federation ingest"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="section-head" style={{ marginBottom: "var(--s-4)" }}>
              <div>
                <h3>More from this event</h3>
              </div>
              <Link className="link-arrow" href={`/events/${event.slug}`}>
                All results <Icon name="arrow" />
              </Link>
            </div>
            {others.length > 0 ? (
              <div className="grid grid-3">
                {others.map((d) => {
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
                        <span className="dur num">{fmtDuration(d.durationSec)}</span>
                      </div>
                      <div className="vbody">
                        <div className="who">
                          <CountryChip code={a.country} />
                          {a.name}
                        </div>
                        <div className="meta">
                          {d.discipline} · Day {d.day}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : relatedPerformances.length > 0 ? (
              <div className="rt-wrap">
                <table className="rt">
                  <thead>
                    <tr>
                      <th className="l">Athlete</th>
                      <th>Disc</th>
                      <th>RP</th>
                      <th>Card</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedPerformances.map((p) => {
                      const a = repo.getAthleteBySlug(p.athleteSlug);
                      if (!a) return null;
                      return (
                        <tr key={p.id}>
                          <td className="n">
                            <CountryChip code={a.country} />
                            <Link href={`/dives/${p.diveId}`}>{a.name}</Link>
                          </td>
                          <td>{p.discipline}</td>
                          <td className="num">
                            {p.card === "R" ? "DQ" : fmtValue(p.discipline, p.rp)}
                          </td>
                          <td>
                            <CardBadge card={p.card} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted small">No other dives from this event in the seed.</p>
            )}
          </div>
        </div>

        <aside className="stack" style={{ gap: "var(--s-4)" }} aria-label="Dive result">
          <div className="result-card">
            <div className="row row--between row--wrap">
              <div className="row" style={{ gap: 10 }}>
                <CountryChip code={athlete.country} neutral={athlete.neutral} />
                <Link
                  href={`/athletes/${athlete.slug}`}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: "1.25rem",
                    color: "var(--text)",
                  }}
                >
                  {athlete.name}
                </Link>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {dive.wr && (
                  <span className="badge badge--record" title="World record">
                    WR
                  </span>
                )}
                <CardBadge card={dive.card} large />
              </div>
            </div>
            <div>
              <div className="eyebrow">
                {dive.discipline} ·{" "}
                {repo.getDb().disciplines.find((x) => x.code === dive.discipline)?.name}
              </div>
              <div className="result-big" style={{ marginTop: 8 }}>
                {dive.card === "R" ? (
                  <b className="num">DQ</b>
                ) : (
                  <>
                    <b className="num">{dive.rp}</b>
                    <small>{dive.discipline === "STA" ? "s" : "m"}</small>
                  </>
                )}
              </div>
            </div>
            <div className="kv">
              <div>
                <div className="k">
                  <abbr title="Announced performance">AP</abbr> →{" "}
                  <abbr title="Realised performance">RP</abbr>
                </div>
                <div className="v num">
                  {fmtValue(dive.discipline, dive.ap)} →{" "}
                  {dive.card === "R" ? "DQ" : fmtValue(dive.discipline, dive.rp)}
                </div>
              </div>
              <div>
                <div className="k">Duration</div>
                <div className="v num">
                  {dive.hasVideo ? fmtDuration(dive.durationSec) : "—"}
                </div>
              </div>
              <div>
                <div className="k">Status</div>
                <div className="v" style={{ fontSize: "1rem", paddingTop: 4 }}>
                  <span
                    className={`status ${dive.status === "provisional" ? "status--prov" : "status--ok"}`}
                  >
                    {dive.status}
                  </span>
                </div>
              </div>
            </div>
            <div className={`annot ${annotClass}`}>
              <h4>
                <Icon
                  name={
                    dive.annotation.type === "none"
                      ? "check-circle"
                      : dive.annotation.type === "penalty"
                        ? "info"
                        : "flag"
                  }
                />{" "}
                Judges&rsquo; annotation
              </h4>
              <p className="fine">{dive.annotation.text}</p>
            </div>
            {dive.card !== "R" && wr > 0 && (
              <div className="context">
                <div className="row row--between">
                  <span className="small">% of world record</span>
                  <b className="num">{pct.toFixed(1)}%</b>
                </div>
                <div className="pbar pbar--lg">
                  <i style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            )}
            <hr className="divider" style={{ margin: 0 }} />
            <div className="small muted">
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <Icon name="calendar" />
                <Link href={`/events/${event.slug}`}>{event.name}</Link>
              </div>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <Icon name="clock" /> {fmtDate(dive.date)} · Day {dive.day} · OT{" "}
                {dive.ot}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="source">
                  <Icon name="check-circle" /> Source: {event.federation}
                </span>
              </div>
            </div>
          </div>

          <div className="buybox">
            {dive.hasVideo ? (
              <>
                <div className="row row--between">
                  <div>
                    <div className="eyebrow" style={{ color: "#9fd9e3" }}>
                      Footage
                    </div>
                    <div className="price">
                      €{dive.price}
                      <small>dive clip</small>
                    </div>
                  </div>
                  <Icon name="film" />
                </div>
                <ul className="checklist">
                  <li>
                    <Icon name="check" /> Social edit, vertical and horizontal, result
                    overlay
                  </li>
                  <li>
                    <Icon name="check" /> Delivered within 72 h after the competition
                    day
                  </li>
                  <li>
                    <Icon name="check" /> Personal licence. Commercial add-on +€100
                  </li>
                </ul>
                <AddToCartButton
                  title={`Dive clip: ${athlete.name
                    .split(" ")
                    .map((p, i, a) => (i === a.length - 1 ? p : p[0] + "."))
                    .join(" ")}, ${dive.discipline} ${
                    dive.card === "R" ? "DQ" : dive.rp + " m"
                  }`}
                  description="Social edit · personal licence"
                  price={dive.price}
                  scene={dive.scene}
                />
                <div className="row row--between row--wrap">
                  <AddToCartButton
                    title={`Event pack: ${athlete.name}`}
                    description={`${event.shortName} · all dives`}
                    price={79}
                    scene={{ h: 196, x: "50%", d: 0.4 }}
                    label="Add to event pack · €79"
                    ghost
                  />
                  <Link className="link-arrow small" href="/shop">
                    Compare options <Icon name="arrow" />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="row row--between">
                  <div>
                    <div className="eyebrow" style={{ color: "#9fd9e3" }}>
                      Footage
                    </div>
                    <h3 style={{ fontSize: "1.15rem", marginTop: 6 }}>
                      Not available yet
                    </h3>
                  </div>
                  <Icon name="film" />
                </div>
                <p className="small muted" style={{ margin: "12px 0 16px" }}>
                  Official result is shown above. When Diveye links OT footage,
                  you will be able to preview a sample and buy a personal or
                  commercial licence here. Checkout is not open yet.
                </p>
                <Link className="btn btn--primary btn--block" href="/shop">
                  See licence plans
                </Link>
                <Link
                  className="btn btn--ghost btn--block"
                  href="/claim"
                  style={{ marginTop: 8 }}
                >
                  Claim profile · get notified
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
