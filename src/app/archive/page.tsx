import Link from "next/link";
import type { Metadata } from "next";
import { CardBadge } from "@/components/CardBadge";
import { CountryChip } from "@/components/CountryChip";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { fmtDuration, fmtValue } from "@/lib/format";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Archive / VOD",
  description: "Search Diveye dive archive with markers.",
  alternates: { canonical: "/archive" },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ArchivePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.toLowerCase() ?? "";
  const repo = getRepository();
  let dives = repo.listShowcaseDives();
  if (q) {
    dives = dives.filter((d) => {
      const a = repo.getAthleteBySlug(d.athleteSlug);
      const ev = repo.getEventById(d.eventId);
      const hay = `${d.title} ${a?.name} ${ev?.name} ${d.discipline}`.toLowerCase();
      return hay.includes(q);
    });
  }
  const search = q ? repo.search(q) : { athletes: [], events: [] };
  const hasFootage = repo.listShowcaseDives().length > 0;

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Archive</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Archive / VOD</h1>
          <p>
            Search dives with OT markers. Sample preview → licence purchase when
            footage is linked.
          </p>
        </div>
      </div>
      <form
        className="hero-search"
        action="/archive"
        style={{ maxWidth: 640, marginBottom: 28 }}
      >
        <Icon name="search" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Athlete, event, discipline…"
          aria-label="Search archive"
        />
        <button className="btn btn--primary" type="submit">
          Search
        </button>
      </form>

      {q && (search.athletes.length > 0 || search.events.length > 0) && (
        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <p className="eyebrow">Also matched in results data</p>
          <div className="row row--wrap" style={{ gap: 10, marginTop: 10 }}>
            {search.athletes.map((a) => (
              <Link key={a.id} className="chip" href={`/athletes/${a.slug}`}>
                <CountryChip code={a.country} /> {a.name}
              </Link>
            ))}
            {search.events.map((e) => (
              <Link key={e.id} className="chip" href={`/events/${e.slug}`}>
                {e.shortName}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!hasFootage ? (
        <EmptyState
          icon="film"
          title="Diveye archive is empty for now"
          body="Federation results are online on athlete and event pages. VOD clips with OT markers will land here once production footage is linked — we are not showing fake videos."
          actionHref="/athletes"
          actionLabel="Browse athletes"
        />
      ) : dives.length === 0 ? (
        <EmptyState
          icon="search"
          title={q ? `No dives matched “${q}”` : "No dives to show"}
          body="Try another athlete, event or discipline, or browse rankings."
          actionHref="/rankings"
          actionLabel="Open rankings"
        />
      ) : (
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
                        ["--h" as string]: d.scene.h,
                        ["--x" as string]: d.scene.x,
                        ["--d" as string]: d.scene.d,
                      }
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
                    {d.discipline} · {d.markers.length} markers
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
