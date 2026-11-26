import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CardBadge } from "@/components/CardBadge";
import { CountryChip } from "@/components/CountryChip";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { fmtDate, fmtValue, siteUrl } from "@/lib/format";
import { athleteRank } from "@/lib/ranking";
import { getRepository } from "@/lib/repository";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return getRepository()
    .listAthletes({ includeMinors: true })
    .map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const a = getRepository().getAthleteBySlug(slug);
  if (!a) return { title: "Athlete" };
  return {
    title: a.name,
    description: a.minor
      ? "Restricted junior athlete profile on Depthboard."
      : `${a.name} · ${a.countryName} freediving results and footage.`,
    robots: a.minor ? { index: false, follow: false } : { index: true, follow: true },
    alternates: { canonical: `/athletes/${a.slug}` },
    openGraph: {
      title: a.name,
      description: `${a.countryName} · Depthboard`,
      url: siteUrl(`/athletes/${a.slug}`),
    },
  };
}

export default async function AthletePage({ params }: { params: Params }) {
  const { slug } = await params;
  const repo = getRepository();
  const db = repo.getDb();
  const athlete = repo.getAthleteBySlug(slug);
  if (!athlete) notFound();

  const rank = athleteRank(db, athlete);
  const performances = db.performances
    .filter((p) => p.athleteId === athlete.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const showcase = repo
    .listShowcaseDives()
    .filter((d) => d.athleteSlug === athlete.slug);

  if (athlete.minor) {
    return (
      <div className="container section">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <Icon name="chev-r" />
          <Link href="/athletes">Athletes</Link>
          <Icon name="chev-r" />
          <span aria-current="page">{athlete.name}</span>
        </nav>
        <div className="card" style={{ marginTop: 24, padding: 28, maxWidth: 640 }}>
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <Icon name="lock" />
            <span className="badge">Restricted · under 18</span>
          </div>
          <h1 style={{ fontSize: "1.75rem" }}>{athlete.name}</h1>
          <p className="muted" style={{ marginTop: 12 }}>
            This junior profile is privacy-restricted. Public pages hide detailed bio,
            contact paths and social links. Results remain visible for safety and
            competition transparency, with guardian consent assumed in seed data.
          </p>
          <div className="row" style={{ gap: 10, marginTop: 18 }}>
            <CountryChip code={athlete.country} />
            <span className="small muted">{athlete.countryName}</span>
          </div>
          <table className="rs" style={{ marginTop: 20 }}>
            <thead>
              <tr>
                <th className="l">Discipline</th>
                <th>Result</th>
                <th>Card</th>
                <th className="l">Date</th>
              </tr>
            </thead>
            <tbody>
              {performances.slice(0, 8).map((p) => (
                <tr key={p.id}>
                  <td>{p.discipline}</td>
                  <td className="num">{p.card === "R" ? "DQ" : fmtValue(p.discipline, p.rp)}</td>
                  <td>
                    <CardBadge card={p.card} />
                  </td>
                  <td>{fmtDate(p.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="caption" style={{ marginTop: 14 }}>
            Guardians can manage visibility via claim.{" "}
            <Link href="/claim">Claim / guardian access</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: athlete.name,
          nationality: athlete.countryName,
          url: siteUrl(`/athletes/${athlete.slug}`),
          sport: "Freediving",
        }}
      />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <Link href="/athletes">Athletes</Link>
        <Icon name="chev-r" />
        <span aria-current="page">{athlete.name}</span>
      </nav>

      <div className="row row--between row--wrap" style={{ marginTop: 18, gap: 16 }}>
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <CountryChip code={athlete.country} neutral={athlete.neutral} />
            <span className="eyebrow">{athlete.countryName}</span>
            {athlete.claimed && <span className="badge badge--accent">Claimed</span>}
          </div>
          <h1>{athlete.name}</h1>
          <p className="muted" style={{ marginTop: 10, maxWidth: 560 }}>
            {athlete.bio}
          </p>
        </div>
        <div className="stat">
          <b className="num">{rank ? `#${rank}` : "—"}</b>
          <span>Portal active</span>
        </div>
      </div>

      <div className="row row--wrap" style={{ gap: 10, marginTop: 18 }}>
        <Link className="btn btn--primary" href="/claim">
          <Icon name="shield" /> Claim this profile
        </Link>
        <Link className="btn btn--ghost" href="/shop">
          <Icon name="film" /> Buy footage
        </Link>
      </div>

      {showcase.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <h2 style={{ marginBottom: 14 }}>Featured dives</h2>
          <div className="grid grid-3">
            {showcase.map((d) => (
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
                  <div className="who">{d.discipline}</div>
                  <div className="meta">
                    Day {d.day} · {fmtDate(d.date)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 36 }}>
        <h2 style={{ marginBottom: 14 }}>Recent results</h2>
        <div className="rt-wrap">
          <table className="rt">
            <thead>
              <tr>
                <th className="l">Date</th>
                <th>Disc</th>
                <th>AP→RP</th>
                <th>Card</th>
                <th className="l">Event</th>
                <th>Fed</th>
              </tr>
            </thead>
            <tbody>
              {performances.slice(0, 20).map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.discipline}</td>
                  <td className="num">
                    {fmtValue(p.discipline, p.ap)} →{" "}
                    {p.card === "R" ? "DQ" : fmtValue(p.discipline, p.rp)}
                  </td>
                  <td>
                    <CardBadge card={p.card} />
                  </td>
                  <td>{p.eventName}</td>
                  <td>
                    <span className="badge badge--fed">{p.federation}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
