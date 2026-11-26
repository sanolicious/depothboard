import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CardBadge } from "@/components/CardBadge";
import { CountryChip } from "@/components/CountryChip";
import { DivePlayer } from "@/components/DivePlayer";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { DiveRightsPanel, RightsBadge } from "@/components/DiveRightsPanel";
import { resolveDive } from "@/lib/dives";
import { fmtDate, fmtDuration, fmtValue, siteUrl } from "@/lib/format";
import { getRepository } from "@/lib/repository";
import {
  evaluateShowcaseDive,
  getRecordingRights,
  hasConsent,
} from "@/lib/rights";

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
      ? `Dive page with OT markers and Diveye footage · ${dive.discipline}`
      : dive.cmasEmbedOnly
        ? `Official result · ${dive.discipline} · CMAS embed/link`
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
  const db = repo.getDb();
  const rights = getRecordingRights(db, dive.id);
  const sale =
    dive.hasVideo || rights
      ? evaluateShowcaseDive(db, {
          ...dive,
          licenseTier: dive.hasVideo ? "social" : "sample",
        })
      : null;
  const wr = db.wr[athlete.sex][dive.discipline];
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
            <DivePlayer
              hasVideo={dive.hasVideo}
              cmasEmbedOnly={dive.cmasEmbedOnly || !!rights?.embedOnly}
              footagePending={dive.footagePending}
              previewUrl={dive.previewUrl}
              posterUrl={dive.posterUrl}
              embedUrl={dive.embedUrl || rights?.embedUrl}
              eventLiveUrl={event.liveUrl}
              cameras={dive.cameras}
              markers={dive.markerSeek}
              scene={dive.scene}
              discipline={dive.discipline}
              rp={dive.rp}
              card={dive.card}
              ot={dive.ot}
              durationSec={dive.durationSec}
            />
            {(rights?.rightsModel === "diveye_owned" || rights?.embedOnly) && (
              <div className="row row--wrap" style={{ gap: 8, marginTop: 10 }}>
                {rights?.rightsModel === "diveye_owned" && rights.downloadable && (
                  <span className="badge" style={{ background: "rgba(20,90,70,.75)", color: "#fff" }}>
                    AIDA · downloadable
                  </span>
                )}
                {rights?.embedOnly && (
                  <span className="badge" style={{ background: "rgba(120,70,20,.75)", color: "#fff" }}>
                    CMAS · link only
                  </span>
                )}
                {dive.footageAssetId && (
                  <span className="badge">
                    FootageAsset · {dive.footageQuality ?? "preview"}
                  </span>
                )}
              </div>
            )}
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
              <div className="row row--wrap" style={{ gap: 8 }}>
                <span className="source">
                  <Icon name="check-circle" /> Source: {event.federation}
                </span>
                {sale && (
                  <RightsBadge
                    label={
                      sale.badge === "downloadable"
                        ? "AIDA downloadable"
                        : sale.badge === "embed_only"
                          ? "CMAS embed-only"
                          : sale.badge === "preview"
                            ? "Preview"
                            : "Not for sale"
                    }
                    tone={
                      sale.badge === "downloadable"
                        ? "ok"
                        : sale.badge === "embed_only" || sale.badge === "unavailable"
                          ? "warn"
                          : "neutral"
                    }
                  />
                )}
                <RightsBadge
                  label={`Rights: ${event.rightsModel}`}
                  tone={event.rightsModel === "diveye_owned" ? "ok" : "warn"}
                />
              </div>
            </div>
          </div>

          <DiveRightsPanel
            athleteSlug={athlete.slug}
            athleteName={athlete.name}
            diveTitle={dive.title}
            discipline={dive.discipline}
            rpLabel={dive.card === "R" ? "DQ" : `${dive.rp} m`}
            price={dive.price}
            scene={dive.scene}
            hasVideo={dive.hasVideo}
            eventShortName={event.shortName}
            eventLiveUrl={event.liveUrl}
            rights={rights}
            licenseTier="social"
            seedFlags={{
              recording: hasConsent(db, athlete.slug, "recording"),
              publication: hasConsent(db, athlete.slug, "publication"),
              commercial: hasConsent(db, athlete.slug, "commercial"),
              guardianOk: !!athlete.guardianConsentGranted,
              minor: athlete.minor,
            }}
          />
        </aside>
      </div>
    </div>
  );
}
