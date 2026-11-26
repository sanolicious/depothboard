import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CountryChip } from "@/components/CountryChip";
import { Icon } from "@/components/Icon";
import {
  CENTER_COURSE_TYPE_LABELS,
  centerPinStyle,
  fmtPriceRange,
  getDiveCenterBySlug,
  listDiveCenters,
} from "@/lib/centers";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return listDiveCenters().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const center = getDiveCenterBySlug(slug);
  if (!center) return { title: "Center" };
  return {
    title: `${center.name} · Centers`,
    description: center.summary,
    alternates: { canonical: `/centers/${center.slug}` },
  };
}

export default async function CenterProfilePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const center = getDiveCenterBySlug(slug);
  if (!center) notFound();

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <Link href="/centers">Centers</Link>
        <Icon name="chev-r" />
        <span aria-current="page">{center.name}</span>
      </nav>

      <div
        aria-hidden
        style={{
          marginTop: 16,
          height: 140,
          borderRadius: "var(--r-lg)",
          background: `linear-gradient(135deg, hsl(${center.photoHue} 42% 28%), hsl(${(center.photoHue + 40) % 360} 35% 14%))`,
        }}
      />

      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <div className="row row--wrap" style={{ gap: 8, marginBottom: 8 }}>
            <span className="badge">{center.kind}</span>
            <span className="badge badge--fed">
              <CountryChip code={center.country} /> {center.country}
            </span>
            {center.diveyeConnected ? (
              <span className="badge badge--accent">Diveye Connected</span>
            ) : (
              <span className="badge">No Diveye kit</span>
            )}
          </div>
          <h1>{center.name}</h1>
          <p>{center.summary}</p>
          <p className="caption" style={{ marginTop: 8 }}>
            {center.city} · {center.venue} · {center.languages.join(", ")}
          </p>
        </div>
        <Link className="btn btn--ghost" href="/centers">
          All centers
        </Link>
      </div>

      <p className="coach-disclaimer" role="note">
        <Icon name="info" /> Catalog profile only (Diveye S1.8 light). Course
        booking and payments stay with the venue — not on Depthboard in this
        MVP.
      </p>

      <div className="grid grid-2" style={{ marginTop: 20, gap: 16 }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: "1.15rem" }}>About</h2>
            <p className="small" style={{ marginTop: 10, lineHeight: 1.55 }}>
              {center.description}
            </p>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: "1.15rem" }}>Courses</h2>
            <ul style={{ marginTop: 12, paddingLeft: 18 }}>
              {center.courses.map((course) => (
                <li key={course} className="small" style={{ marginBottom: 6 }}>
                  {course}
                </li>
              ))}
            </ul>
            <p className="caption" style={{ marginTop: 10 }}>
              Filter families:{" "}
              {center.courseTypes
                .map((t) => CENTER_COURSE_TYPE_LABELS[t])
                .join(" · ")}
            </p>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: "1.15rem" }}>Pricing (orientative)</h2>
            <p className="small" style={{ marginTop: 10 }}>
              Typical course / day rates{" "}
              <strong>
                {fmtPriceRange(center.priceFromEur, center.priceToEur)}
              </strong>
              . Confirm with the venue — Depthboard does not take payment here.
            </p>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="map-panel" style={{ minHeight: 280 }} aria-label="Location">
            <span
              className={`map-dot${center.diveyeConnected ? " map-dot--diveye" : ""}`}
              style={centerPinStyle(center.lat, center.lng)}
              title={center.name}
            />
            <div
              style={{ position: "absolute", left: 16, bottom: 16, zIndex: 1 }}
              className="small muted"
            >
              {center.lat.toFixed(3)}, {center.lng.toFixed(3)} · schematic pin
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: "1.15rem" }}>Diveye Connected</h2>
            <p className="small" style={{ marginTop: 10, lineHeight: 1.55 }}>
              {center.diveyeConnected
                ? "This venue can run Diveye Connected capture for training or film days. Footage pathways still follow portal rights — ask the school for kit availability."
                : "No Diveye Connected kit in the seed. The center still appears for country and course discovery."}
            </p>
            {center.website ? (
              <p style={{ marginTop: 14 }}>
                <a
                  className="btn btn--sm"
                  href={center.website}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Venue website
                </a>
              </p>
            ) : null}
            <p style={{ marginTop: 12 }}>
              <Link className="link-arrow" href="/coaching">
                Remote coaching instead <Icon name="arrow" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
