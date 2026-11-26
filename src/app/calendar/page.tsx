import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { fmtDate } from "@/lib/format";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Calendar & map",
  description: "Freediving competition calendar with map overview.",
  alternates: { canonical: "/calendar" },
};

/** Rough equirectangular projection into the schematic panel. */
function pinStyle(lat: number, lng: number) {
  const left = ((lng + 180) / 360) * 100;
  const top = ((90 - lat) / 180) * 100;
  return {
    left: `${Math.min(92, Math.max(8, left))}%`,
    top: `${Math.min(88, Math.max(12, top))}%`,
  };
}

export default function CalendarPage() {
  const events = getRepository().listEvents();

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Calendar</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Calendar &amp; map</h1>
          <p>Live, upcoming and past events. Pins are illustrative for the MVP seed.</p>
        </div>
      </div>
      <div
        className="grid calendar-split"
        style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 24 }}
      >
        <div className="map-panel" aria-label="Event map">
          {events.map((ev) => (
            <Link
              key={ev.id}
              href={`/events/${ev.slug}`}
              className={`map-dot${ev.status === "live" ? " map-dot--live" : ""}`}
              style={pinStyle(ev.lat, ev.lng)}
              title={ev.name}
              aria-label={ev.name}
            />
          ))}
          <div style={{ position: "absolute", left: 16, bottom: 16, zIndex: 1 }} className="small muted">
            Schematic world map · click pins for event pages
          </div>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {events.map((ev) => (
            <Link key={ev.id} className="event-card" href={`/events/${ev.slug}`}>
              <div className="row row--between">
                <span
                  className={`badge${
                    ev.status === "live"
                      ? " badge--live"
                      : ev.status === "upcoming"
                        ? " badge--accent"
                        : ""
                  }`}
                >
                  {ev.status === "live" ? (
                    <>
                      <span className="dot-live" /> LIVE
                    </>
                  ) : (
                    ev.status
                  )}
                </span>
                <span className="badge badge--fed">{ev.federation}</span>
              </div>
              <h3 style={{ marginTop: 10 }}>{ev.shortName}</h3>
              <p className="where">
                {ev.venue} · {fmtDate(ev.startDate)} – {fmtDate(ev.endDate)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
