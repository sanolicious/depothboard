import { readFileSync } from "fs";
import path from "path";
import type {
  Athlete,
  Event,
  Performance,
  Product,
  RankingOpts,
  RankingRow,
  SeedDb,
  ShowcaseDive,
} from "@/types/domain";
import { computeRanking } from "@/lib/ranking";

export interface Repository {
  getDb(): SeedDb;
  listAthletes(opts?: { q?: string; includeMinors?: boolean }): Athlete[];
  getAthleteBySlug(slug: string): Athlete | undefined;
  listEvents(opts?: {
    status?: Event["status"] | "all";
    sort?: "asc" | "desc";
    limit?: number;
  }): Event[];
  getEventBySlug(slug: string): Event | undefined;
  getEventById(id: string): Event | undefined;
  getRanking(opts: RankingOpts): RankingRow[];
  getShowcaseDive(id: string): ShowcaseDive | undefined;
  listShowcaseDives(): ShowcaseDive[];
  listProducts(): Product[];
  getPerformanceByDiveId(diveId: string): Performance | undefined;
  listPerformancesForEvent(eventId: string, limit?: number): Performance[];
  search(q: string): {
    athletes: Athlete[];
    events: Event[];
  };
}

let cached: SeedDb | null = null;

function loadSeed(): SeedDb {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "seed.json");
  cached = JSON.parse(readFileSync(file, "utf8")) as SeedDb;
  return cached;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase();
}

class JsonRepository implements Repository {
  getDb(): SeedDb {
    return loadSeed();
  }

  listAthletes(opts: { q?: string; includeMinors?: boolean } = {}): Athlete[] {
    const db = this.getDb();
    let list = db.athletes;
    if (!opts.includeMinors) list = list.filter((a) => !a.minor);
    if (opts.q) {
      const q = normalize(opts.q);
      list = list.filter(
        (a) =>
          normalize(a.name).includes(q) ||
          normalize(a.country).includes(q) ||
          normalize(a.countryName).includes(q),
      );
    }
    return list;
  }

  getAthleteBySlug(slug: string): Athlete | undefined {
    return this.getDb().athletes.find((a) => a.slug === slug);
  }

  listEvents(
    opts: {
      status?: Event["status"] | "all";
      sort?: "asc" | "desc";
      limit?: number;
    } = {},
  ): Event[] {
    const db = this.getDb();
    let list =
      !opts.status || opts.status === "all"
        ? db.events
        : db.events.filter((e) => e.status === opts.status);
    const dir = opts.sort === "desc" ? -1 : 1;
    list = [...list].sort(
      (a, b) => dir * a.startDate.localeCompare(b.startDate),
    );
    if (opts.limit !== undefined) list = list.slice(0, opts.limit);
    return list;
  }

  getEventBySlug(slug: string): Event | undefined {
    return this.getDb().events.find((e) => e.slug === slug);
  }

  getEventById(id: string): Event | undefined {
    return this.getDb().events.find((e) => e.id === id);
  }

  getRanking(opts: RankingOpts): RankingRow[] {
    return computeRanking(this.getDb(), opts);
  }

  getShowcaseDive(id: string): ShowcaseDive | undefined {
    return this.getDb().showcaseDives.find((d) => d.id === id);
  }

  listShowcaseDives(): ShowcaseDive[] {
    return this.getDb().showcaseDives;
  }

  listProducts(): Product[] {
    return this.getDb().products;
  }

  getPerformanceByDiveId(diveId: string): Performance | undefined {
    return this.getDb().performances.find((p) => p.diveId === diveId);
  }

  listPerformancesForEvent(eventId: string, limit = 48): Performance[] {
    return this.getDb()
      .performances.filter((p) => p.eventId === eventId)
      .sort((a, b) => b.rp - a.rp)
      .slice(0, limit);
  }

  search(q: string) {
    const query = q.trim();
    if (!query) return { athletes: [], events: [] };
    return {
      athletes: this.listAthletes({ q: query, includeMinors: false }).slice(0, 8),
      events: this.listEvents({ sort: "desc" })
        .filter((e) =>
          normalize(`${e.name} ${e.venue} ${e.federation}`).includes(
            normalize(query),
          ),
        )
        .slice(0, 6),
    };
  }
}

/** Swap this for a PostgresRepository later — same interface. */
export function getRepository(): Repository {
  return new JsonRepository();
}
