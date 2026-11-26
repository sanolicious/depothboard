import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CardBadge } from "@/components/CardBadge";
import { CountryChip } from "@/components/CountryChip";
import { fmtValue } from "@/lib/format";
import { getRepository } from "@/lib/repository";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const ev = getRepository().getEventBySlug(slug);
  return {
    title: ev ? `Embed · ${ev.shortName}` : "Embed",
    robots: { index: false, follow: false },
  };
}

export default async function EmbedEventPage({ params }: { params: Params }) {
  const { slug } = await params;
  const repo = getRepository();
  const ev = repo.getEventBySlug(slug);
  if (!ev) notFound();
  const db = repo.getDb();
  const rows = db.liveResults;

  return (
    <div className="embed-shell">
      <div className="card" style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
        <div className="row row--between">
          <div>
            <div className="eyebrow">{ev.federation}</div>
            <h1 style={{ fontSize: "1.25rem", marginTop: 4 }}>{ev.shortName}</h1>
          </div>
          {ev.status === "live" && (
            <span className="badge badge--live"><span className="dot-live" /> LIVE</span>
          )}
        </div>
        <table className="rs" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th className="l">#</th>
              <th className="l">Athlete</th>
              <th>AP</th>
              <th>RP</th>
              <th>Card</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = repo.getAthleteBySlug(r.athleteSlug)!;
              return (
                <tr key={r.athleteSlug}>
                  <td className="p">{r.place}</td>
                  <td className="n">
                    <CountryChip code={a.country} /> {a.name}
                  </td>
                  <td className="num">{r.ap}</td>
                  <td className="num">{fmtValue("CWT", r.rp)}</td>
                  <td><CardBadge card={r.card} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="caption" style={{ marginTop: 10 }}>Powered by Depthboard · sample embed</p>
      </div>
    </div>
  );
}
