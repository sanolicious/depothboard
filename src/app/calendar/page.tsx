import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { fmtDate } from "@/lib/format";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Calendar & map",
  description: "Freediving competition calendar with map overview.",
  alternates: { canonical: "/calendar" },
};

const LIST_LIMIT = 40;
const MAP_LIMIT = 80;

/** Rough equirectangular projection into the schematic panel. */
function pinStyle(lat: number, lng: number) {
  const left = ((lng + 180) / 360) * 100;
  const top = ((90 - lat) / 180) * 100;
  return {
    left: `${Math.min(92, Math.max(8, left))}%`,
    top: `${Math.min(88, Math.max(12, top))}%`,
  };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined, fallback: string) {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filter = one(sp.status, "all");
  const page = Math.max(1, parseInt(one(sp.page, "1"), 10) || 1);
  const repo = getRepository();

  const live = repo.listEvents({ status: "live", sort: "desc" });
  const upcoming = repo.listEvents({ status: "upcoming", sort: "asc" });
  const past = repo.listEvents({ status: "past", sort: "desc" });

  const pool =
    filter === "live"
      ? live
      : filter === "upcoming"
        ? upcoming
        : filter === "past"
          ? past
          : [...live, ...upcoming, ...past];

  const total = pool.length;
  const totalPages = Math.max(1, Math.ceil(total / LIST_LIMIT));
  const safePage = Math.min(page, totalPages);
  const events = pool.slice((safePage - 1) * LIST_LIMIT, safePage * LIST_LIMIT);
  const mapEvents = pool.slice(0, MAP_LIMIT);

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("status", filter);
    Object.entries(patch).forEach(([k, v]) => {
      if (v && !(k === "status" && v === "all") && !(k === "page" && v === "1")) {
        p.set(k, v);
      }
    });
    const s = p.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };

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
          <p>
            {live.length === 0 && upcoming.length === 0
              ? "Current seed has past competitions only — live and upcoming appear when ingest marks them."
              : "Live, upcoming and past events. Pins are schematic for the MVP."}
          </p>
        </div>
      </div>

      <div className="row row--wrap" style={{ gap: 8, marginBottom: 20 }}>
        {(
          [
            ["all", `All (${live.length + upcoming.length + past.length})`],
            ["live", `Live (${live.length})`],
            ["upcoming", `Upcoming (${upcoming.length})`],
            ["past", `Past`],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={qs({ status: key, page: "1" })}
            className="chip"
            aria-current={filter === key ? "page" : undefined}
            style={
              filter === key
                ? { borderColor: "var(--accent)", color: "var(--accent)" }
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={
            filter === "live"
              ? "No live events"
              : filter === "upcoming"
                ? "No upcoming events"
                : "No events"
          }
          body="When the next competition is ingested as live or upcoming, it will show here with a Watch live path."
          actionHref="/rankings"
          actionLabel="Browse rankings"
        />
      ) : (
        <div
          className="grid calendar-split"
          style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 24 }}
        >
          <div className="map-panel" aria-label="Event map">
            {mapEvents.map((ev) => (
              <Link
                key={ev.id}
                href={`/events/${ev.slug}`}
                className={`map-dot${ev.status === "live" ? " map-dot--live" : ""}`}
                style={pinStyle(ev.lat, ev.lng)}
                title={ev.name}
                aria-label={ev.name}
              />
            ))}
            <div
              style={{ position: "absolute", left: 16, bottom: 16, zIndex: 1 }}
              className="small muted"
            >
              Schematic map · up to {MAP_LIMIT} pins for this filter
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
            {totalPages > 1 && (
              <div className="row row--between" style={{ marginTop: 8 }}>
                <span className="small muted">
                  Page {safePage} of {totalPages} · {total.toLocaleString("en-GB")}{" "}
                  events
                </span>
                <div className="row" style={{ gap: 8 }}>
                  {safePage > 1 && (
                    <Link
                      className="btn btn--sm btn--ghost"
                      href={qs({ status: filter, page: String(safePage - 1) })}
                    >
                      Previous
                    </Link>
                  )}
                  {safePage < totalPages && (
                    <Link
                      className="btn btn--sm"
                      href={qs({ status: filter, page: String(safePage + 1) })}
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
