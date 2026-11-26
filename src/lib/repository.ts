import { readFileSync } from "fs";
import path from "path";
import type {
  Athlete,
  Event,
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
  listEvents(opts?: { status?: Event["status"] | "all" }): Event[];
  getEventBySlug(slug: string): Event | undefined;
  getEventById(id: string): Event | undefined;
  getRanking(opts: RankingOpts): RankingRow[];
  getShowcaseDive(id: string): ShowcaseDive | undefined;
  listShowcaseDives(): ShowcaseDive[];
  listProducts(): Product[];
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

  listEvents(opts: { status?: Event["status"] | "all" } = {}): Event[] {
    const db = this.getDb();
    const list =
      !opts.status || opts.status === "all"
        ? db.events
        : db.events.filter((e) => e.status === opts.status);
    return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
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

  search(q: string) {
    const query = q.trim();
    if (!query) return { athletes: [], events: [] };
    return {
      athletes: this.listAthletes({ q: query, includeMinors: false }).slice(0, 8),
      events: this.listEvents().filter((e) =>
        normalize(`${e.name} ${e.venue} ${e.federation}`).includes(normalize(query)),
      ).slice(0, 6),
    };
  }
}

/** Swap this for a PostgresRepository later — same interface. */
export function getRepository(): Repository {
  return new JsonRepository();
}
