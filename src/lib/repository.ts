import { readFileSync, existsSync } from "fs";
import path from "path";
import type {
  Athlete,
  ClaimRequest,
  ConsentRecord,
  Event,
  Performance,
  Product,
  RankingOpts,
  RankingRow,
  RecordingRights,
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
  listConsents(athleteSlug?: string): ConsentRecord[];
  getRecordingRights(diveId: string): RecordingRights | undefined;
  listClaimRequests(): ClaimRequest[];
  search(q: string): {
    athletes: Athlete[];
    events: Event[];
  };
}

type RightsOverlay = {
  mockAccountAthleteSlug?: string;
  claimsInbox?: string;
  provenanceSources?: SeedDb["provenanceSources"];
  licenseTiers?: SeedDb["licenseTiers"];
  athleteOverrides?: Array<{
    slug: string;
    claimed?: boolean;
    guardianConsentGranted?: boolean;
    minor?: boolean;
    status?: Athlete["status"];
    create?: Athlete;
  }>;
  eventOverrides?: Array<Partial<Event> & { id: string }>;
  consents?: ConsentRecord[];
  recordingRights?: RecordingRights[];
  showcaseDives?: ShowcaseDive[];
  products?: Product[];
  claimRequests?: ClaimRequest[];
};

let cached: SeedDb | null = null;

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function applyRightsOverlay(base: SeedDb): SeedDb {
  const overlayPath = path.join(process.cwd(), "data", "rights-overlay.json");
  if (!existsSync(overlayPath)) return base;

  const overlay = loadJson<RightsOverlay>(overlayPath);
  const athletes = [...base.athletes];
  const bySlug = new Map(athletes.map((a, i) => [a.slug, i]));

  for (const ov of overlay.athleteOverrides ?? []) {
    if (ov.create && !bySlug.has(ov.slug)) {
      athletes.push(ov.create);
      bySlug.set(ov.slug, athletes.length - 1);
      continue;
    }
    const idx = bySlug.get(ov.slug);
    if (idx === undefined) continue;
    athletes[idx] = {
      ...athletes[idx],
      ...(ov.claimed !== undefined ? { claimed: ov.claimed } : {}),
      ...(ov.guardianConsentGranted !== undefined
        ? { guardianConsentGranted: ov.guardianConsentGranted }
        : {}),
      ...(ov.minor !== undefined ? { minor: ov.minor } : {}),
      ...(ov.status !== undefined ? { status: ov.status } : {}),
    };
  }

  const events = [...base.events];
  const eventIdx = new Map(events.map((e, i) => [e.id, i]));
  for (const ov of overlay.eventOverrides ?? []) {
    const idx = eventIdx.get(ov.id);
    if (idx === undefined) continue;
    events[idx] = { ...events[idx], ...ov };
  }

  const showcaseById = new Map(
    (overlay.showcaseDives ?? []).map((d) => [d.id, d]),
  );
  const showcaseDives = [
    ...base.showcaseDives.filter((d) => !showcaseById.has(d.id)),
    ...(overlay.showcaseDives ?? []),
  ];

  const productById = new Map((overlay.products ?? []).map((p) => [p.id, p]));
  const products = [
    ...base.products.filter((p) => !productById.has(p.id)),
    ...(overlay.products ?? []),
  ];

  const claimPath = path.join(process.cwd(), "data", "claim-requests.json");
  let claimRequests = overlay.claimRequests ?? [];
  if (existsSync(claimPath)) {
    try {
      const logged = loadJson<ClaimRequest[]>(claimPath);
      if (Array.isArray(logged) && logged.length) {
        const seen = new Set(claimRequests.map((c) => c.id));
        claimRequests = [
          ...claimRequests,
          ...logged.filter((c) => !seen.has(c.id)),
        ];
      }
    } catch {
      /* keep overlay claims */
    }
  }

  return {
    ...base,
    athletes,
    events,
    showcaseDives,
    products,
    provenanceSources: overlay.provenanceSources ?? [],
    licenseTiers: overlay.licenseTiers ?? [],
    consents: overlay.consents ?? [],
    recordingRights: overlay.recordingRights ?? [],
    claimRequests,
    mockAccountAthleteSlug: overlay.mockAccountAthleteSlug,
    claimsInbox: overlay.claimsInbox ?? "claims@depthboard.com",
  };
}

function loadSeed(): SeedDb {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "seed.json");
  const base = loadJson<SeedDb>(file);
  cached = applyRightsOverlay(base);
  return cached;
}

/** Drop in-memory cache (used after claim log writes in the same process). */
export function invalidateSeedCache(): void {
  cached = null;
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

  listConsents(athleteSlug?: string): ConsentRecord[] {
    const list = this.getDb().consents ?? [];
    if (!athleteSlug) return list;
    return list.filter((c) => c.athleteSlug === athleteSlug);
  }

  getRecordingRights(diveId: string): RecordingRights | undefined {
    return (this.getDb().recordingRights ?? []).find((r) => r.diveId === diveId);
  }

  listClaimRequests(): ClaimRequest[] {
    return this.getDb().claimRequests ?? [];
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
