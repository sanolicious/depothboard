import Link from "next/link";
import type { Metadata } from "next";
import { CountryChip } from "@/components/CountryChip";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import {
  ALL_CENTER_COURSE_TYPES,
  CENTER_COURSE_TYPE_LABELS,
  centerPinStyle,
  fmtPriceRange,
  isCenterCourseType,
  listCenterCountries,
  listDiveCenters,
} from "@/lib/centers";
import type { CenterCourseType } from "@/types/domain";

export const metadata: Metadata = {
  title: "Schools & centers map",
  description:
    "Freediving schools and dive centers — filter by country, Diveye Connected, and course type.",
  alternates: { canonical: "/centers" },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined, fallback: string) {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

export default async function CentersCatalogPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;
  const country = one(sp.country, "all").toUpperCase();
  const diveyeRaw = one(sp.diveye, "all");
  const courseRaw = one(sp.course, "all");
  const courseType: CenterCourseType | "all" = isCenterCourseType(courseRaw)
    ? courseRaw
    : "all";
  const diveyeOnly = diveyeRaw === "1" || diveyeRaw === "connected";

  const countries = listCenterCountries();
  const centers = listDiveCenters({
    country: country === "ALL" ? undefined : country,
    diveyeConnected: diveyeOnly ? true : undefined,
    courseType,
  });
  const connectedCount = listDiveCenters({ diveyeConnected: true }).length;

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const nextCountry = patch.country ?? (country === "ALL" ? "all" : country);
    const nextDiveye = patch.diveye ?? (diveyeOnly ? "1" : "all");
    const nextCourse = patch.course ?? courseType;
    if (nextCountry && nextCountry !== "all" && nextCountry !== "ALL") {
      p.set("country", nextCountry);
    }
    if (nextDiveye === "1" || nextDiveye === "connected") {
      p.set("diveye", "1");
    }
    if (nextCourse && nextCourse !== "all") {
      p.set("course", nextCourse);
    }
    const s = p.toString();
    return s ? `/centers?${s}` : "/centers";
  };

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Centers</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Schools &amp; centers</h1>
          <p>
            Diveye S1.7 map catalog · {centers.length} listed ·{" "}
            {connectedCount} with Diveye Connected. Profile pages are light
            (S1.8) — venue booking stays out of this MVP.
          </p>
        </div>
        <Link className="btn btn--ghost" href="/calendar">
          Events calendar
        </Link>
      </div>

      <div className="stack" style={{ gap: 12, marginBottom: 20 }}>
        <div className="row row--wrap" style={{ gap: 8 }} role="group" aria-label="Country">
          <Link
            href={qs({ country: "all" })}
            className="chip"
            aria-current={country === "ALL" ? "page" : undefined}
            style={
              country === "ALL"
                ? { borderColor: "var(--accent)", color: "var(--accent)" }
                : undefined
            }
          >
            All countries
          </Link>
          {countries.map((c) => (
            <Link
              key={c}
              href={qs({ country: c })}
              className="chip"
              aria-current={country === c ? "page" : undefined}
              style={
                country === c
                  ? { borderColor: "var(--accent)", color: "var(--accent)" }
                  : undefined
              }
            >
              <CountryChip code={c} /> {c}
            </Link>
          ))}
        </div>

        <div className="row row--wrap" style={{ gap: 8 }} role="group" aria-label="Diveye Connected">
          <Link
            href={qs({ diveye: "all" })}
            className="chip"
            aria-current={!diveyeOnly ? "page" : undefined}
            style={
              !diveyeOnly
                ? { borderColor: "var(--accent)", color: "var(--accent)" }
                : undefined
            }
          >
            Any gear
          </Link>
          <Link
            href={qs({ diveye: "1" })}
            className="chip"
            aria-current={diveyeOnly ? "page" : undefined}
            style={
              diveyeOnly
                ? { borderColor: "var(--accent)", color: "var(--accent)" }
                : undefined
            }
          >
            Diveye Connected
          </Link>
        </div>

        <div className="row row--wrap" style={{ gap: 8 }} role="group" aria-label="Course type">
          <Link
            href={qs({ course: "all" })}
            className="chip"
            aria-current={courseType === "all" ? "page" : undefined}
            style={
              courseType === "all"
                ? { borderColor: "var(--accent)", color: "var(--accent)" }
                : undefined
            }
          >
            All courses
          </Link>
          {ALL_CENTER_COURSE_TYPES.map((t) => (
            <Link
              key={t}
              href={qs({ course: t })}
              className="chip"
              aria-current={courseType === t ? "page" : undefined}
              style={
                courseType === t
                  ? { borderColor: "var(--accent)", color: "var(--accent)" }
                  : undefined
              }
            >
              {CENTER_COURSE_TYPE_LABELS[t]}
            </Link>
          ))}
        </div>
      </div>

      {centers.length === 0 ? (
        <EmptyState
          icon="pin"
          title="No centers match"
          body="Try clearing a filter — the seed covers several countries and course families."
          actionHref="/centers"
          actionLabel="Reset filters"
        />
      ) : (
        <div
          className="grid calendar-split"
          style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 24 }}
        >
          <div className="map-panel" aria-label="Centers map">
            {centers.map((c) => (
              <Link
                key={c.id}
                href={`/centers/${c.slug}`}
                className={`map-dot${c.diveyeConnected ? " map-dot--diveye" : ""}`}
                style={centerPinStyle(c.lat, c.lng)}
                title={c.name}
                aria-label={`${c.name}${c.diveyeConnected ? " · Diveye Connected" : ""}`}
              />
            ))}
            <div
              style={{ position: "absolute", left: 16, bottom: 16, zIndex: 1 }}
              className="small muted"
            >
              Schematic map · accent = Diveye Connected · {centers.length} pins
            </div>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            {centers.map((c) => (
              <article key={c.id} className="event-card">
                <div className="row row--between row--wrap" style={{ gap: 8 }}>
                  <span className="badge">{c.kind}</span>
                  <div className="row" style={{ gap: 6 }}>
                    {c.diveyeConnected ? (
                      <span className="badge badge--accent">Diveye Connected</span>
                    ) : null}
                    <span className="badge badge--fed">
                      <CountryChip code={c.country} /> {c.country}
                    </span>
                  </div>
                </div>
                <h3 style={{ marginTop: 10 }}>
                  <Link href={`/centers/${c.slug}`}>{c.name}</Link>
                </h3>
                <p className="where">
                  {c.city} · {c.venue}
                </p>
                <p className="small muted" style={{ marginTop: 8 }}>
                  {c.summary}
                </p>
                <p className="caption" style={{ marginTop: 10 }}>
                  {c.courses.slice(0, 3).join(" · ")}
                  {c.courses.length > 3 ? "…" : ""} ·{" "}
                  {fmtPriceRange(c.priceFromEur, c.priceToEur)}
                </p>
                <div style={{ marginTop: 12 }}>
                  <Link className="btn btn--sm" href={`/centers/${c.slug}`}>
                    Profile
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
