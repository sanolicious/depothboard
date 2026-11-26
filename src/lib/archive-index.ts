import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  ArchiveIndexEngine,
  ArchiveIndexFile,
  ArchiveMoment,
  Athlete,
  Card,
  Event,
  FootageAsset,
  FootageMarker,
  FootageMarkerKind,
  Performance,
} from "@/types/domain";

const INDEX_FILE = "archive-index.json";

let indexCache: ArchiveIndexFile | null = null;

function indexPath() {
  return path.join(process.cwd(), "data", INDEX_FILE);
}

function seedPath() {
  return path.join(process.cwd(), "data", "seed.json");
}

function footagePath() {
  return path.join(process.cwd(), "data", "footage.json");
}

type SeedSlice = {
  athletes?: Athlete[];
  events?: Event[];
  performances?: Performance[];
};

type FootageFile = {
  assets?: FootageAsset[];
};

function readSeedSlice(): SeedSlice {
  const file = seedPath();
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as SeedSlice;
  } catch {
    return {};
  }
}

function readFootageAssets(): FootageAsset[] {
  const file = footagePath();
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as FootageFile;
    return Array.isArray(parsed.assets) ? parsed.assets : [];
  } catch {
    return [];
  }
}

export function invalidateArchiveIndexCache(): void {
  indexCache = null;
}

export function loadArchiveIndex(): ArchiveIndexFile {
  if (indexCache) return indexCache;
  const file = indexPath();
  if (!existsSync(file)) {
    indexCache = {
      asOf: "",
      engine: "heuristics",
      momentCount: 0,
      moments: [],
      notes: "Run npm run archive:index or POST /api/archive/index",
    };
    return indexCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as ArchiveIndexFile;
    indexCache = {
      asOf: parsed.asOf ?? "",
      engine: parsed.engine ?? "heuristics",
      notes: parsed.notes,
      momentCount: parsed.momentCount ?? parsed.moments?.length ?? 0,
      moments: Array.isArray(parsed.moments) ? parsed.moments : [],
    };
  } catch {
    indexCache = {
      asOf: "",
      engine: "heuristics",
      momentCount: 0,
      moments: [],
      notes: "Corrupt archive-index.json — rebuild required",
    };
  }
  return indexCache;
}

function persistIndex(index: ArchiveIndexFile): boolean {
  try {
    writeFileSync(indexPath(), JSON.stringify(index, null, 2) + "\n", "utf8");
    indexCache = index;
    return true;
  } catch {
    return false;
  }
}

const KIND_BLURBS: Record<string, string> = {
  start: "Official start / OT window",
  turn: "Turn or bottom marker",
  surface: "Surface break",
  protocol: "Surface protocol / OK sequence",
  penalty: "Penalty cue on the OT timeline",
  blackout: "Blackout-watch cue (observational, not medical)",
  card: "Card / judged outcome cue",
};

function heuristicSummary(opts: {
  athleteName: string;
  discipline: string;
  marker: FootageMarker;
  card?: Card;
  rp?: number;
  eventName: string;
}): string {
  const blurb =
    KIND_BLURBS[opts.marker.kind] ?? `Marker “${opts.marker.label}”`;
  const result =
    opts.card === "R"
      ? "DQ"
      : typeof opts.rp === "number"
        ? `${opts.rp}${opts.discipline === "STA" ? "s" : "m"}`
        : "";
  const resultBit = result ? ` · result ${result}` : "";
  return `${blurb} at ${opts.marker.atSec}s — ${opts.athleteName} · ${opts.discipline}${resultBit} · ${opts.eventName}.`;
}

function momentTags(
  marker: FootageMarker,
  discipline: string,
  athleteSlug: string,
  card?: Card,
): string[] {
  const tags = new Set<string>([
    marker.kind,
    marker.label.toLowerCase(),
    discipline.toLowerCase(),
    athleteSlug,
  ]);
  if (card) tags.add(`card:${card}`);
  if (marker.kind === "blackout") {
    tags.add("bo");
    tags.add("blackout");
  }
  return [...tags];
}

/** Prefer preview assets; skip HQ duplicates and empty CMAS embeds. */
function assetsForIndex(assets: FootageAsset[]): FootageAsset[] {
  const byDive = new Map<string, FootageAsset>();
  for (const asset of assets) {
    if (asset.rightsModel === "cmas_link") continue;
    if (!asset.markers?.length) continue;
    const diveId = asset.performanceDiveId;
    if (!diveId) continue;
    const existing = byDive.get(diveId);
    if (!existing) {
      byDive.set(diveId, asset);
      continue;
    }
    if (existing.quality !== "preview" && asset.quality === "preview") {
      byDive.set(diveId, asset);
    }
  }
  return [...byDive.values()];
}

export function buildArchiveMoments(opts: {
  assets: FootageAsset[];
  athletes: Athlete[];
  events: Event[];
  performances: Performance[];
  engine?: ArchiveIndexEngine;
}): ArchiveMoment[] {
  const engine = opts.engine ?? "heuristics";
  const athleteBySlug = new Map(opts.athletes.map((a) => [a.slug, a]));
  const eventById = new Map(opts.events.map((e) => [e.id, e]));
  const perfByDive = new Map(
    opts.performances
      .filter((p) => p.diveId)
      .map((p) => [p.diveId as string, p]),
  );

  const moments: ArchiveMoment[] = [];
  for (const asset of assetsForIndex(opts.assets)) {
    const diveId = asset.performanceDiveId!;
    const athlete = athleteBySlug.get(asset.athleteSlug);
    const event = eventById.get(asset.eventId);
    const perf = perfByDive.get(diveId);
    const athleteName =
      athlete?.name ??
      asset.athleteSlug
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
    const eventName = event?.shortName || event?.name || asset.eventId;
    const card = perf?.card;
    const rp = perf?.rp;
    const ap = perf?.ap;
    const date = perf?.date ?? event?.startDate;

    for (const marker of asset.markers) {
      const title = `${athleteName} · ${asset.discipline} · ${marker.label}`;
      moments.push({
        id: `${asset.id}:${marker.id}`,
        diveId,
        footageAssetId: asset.id,
        athleteSlug: asset.athleteSlug,
        athleteName,
        eventId: asset.eventId,
        eventName,
        discipline: asset.discipline,
        federation: asset.federation,
        markerId: marker.id,
        markerKind: marker.kind,
        markerLabel: marker.label,
        atSec: marker.atSec,
        at: marker.at,
        title,
        summary: heuristicSummary({
          athleteName,
          discipline: asset.discipline,
          marker,
          card,
          rp,
          eventName,
        }),
        tags: momentTags(marker, asset.discipline, asset.athleteSlug, card),
        card,
        rp,
        ap,
        date,
        seekUrl: `/dives/${diveId}?t=${marker.atSec}`,
        engine,
      });
    }
  }

  return moments.sort((a, b) => {
    const d = (b.date ?? "").localeCompare(a.date ?? "");
    if (d) return d;
    const dive = a.diveId.localeCompare(b.diveId);
    if (dive) return dive;
    return a.atSec - b.atSec;
  });
}

async function maybeEnrichSummaries(
  moments: ArchiveMoment[],
): Promise<{ moments: ArchiveMoment[]; engine: ArchiveIndexEngine }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || moments.length === 0) {
    return { moments, engine: "heuristics" };
  }

  // Enrich a compact sample (first 12) so MVP stays cheap / offlineable.
  const sample = moments.slice(0, 12);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ARCHIVE_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You enrich freediving VOD archive moment summaries. Return JSON {\"items\":[{\"id\":\"...\",\"summary\":\"...\"}]}. One short sentence each. Stay non-medical. Do not invent markers, times, or results. Keep athlete/discipline/marker facts.",
          },
          {
            role: "user",
            content: JSON.stringify({
              items: sample.map((m) => ({
                id: m.id,
                title: m.title,
                markerKind: m.markerKind,
                markerLabel: m.markerLabel,
                atSec: m.atSec,
                baseline: m.summary,
              })),
            }),
          },
        ],
      }),
    });
    if (!res.ok) {
      return { moments, engine: "heuristics" };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { moments, engine: "heuristics" };

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) return { moments, engine: "heuristics" };
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      items?: Array<{ id?: string; summary?: string }>;
    };
    const byId = new Map(
      (parsed.items ?? [])
        .filter((i) => i.id && i.summary)
        .map((i) => [i.id as string, (i.summary as string).trim()]),
    );
    if (byId.size === 0) return { moments, engine: "heuristics" };

    const next = moments.map((m) => {
      const enriched = byId.get(m.id);
      if (!enriched) return m;
      return { ...m, summary: enriched, engine: "llm" as const };
    });
    return { moments: next, engine: "llm" };
  } catch {
    return { moments, engine: "heuristics" };
  }
}

export type RebuildArchiveIndexResult =
  | { ok: true; index: ArchiveIndexFile }
  | { ok: false; error: string };

export async function rebuildArchiveIndex(opts?: {
  enrich?: boolean;
}): Promise<RebuildArchiveIndexResult> {
  const assets = readFootageAssets();
  const seed = readSeedSlice();
  const baseMoments = buildArchiveMoments({
    assets,
    athletes: seed.athletes ?? [],
    events: seed.events ?? [],
    performances: seed.performances ?? [],
    engine: "heuristics",
  });

  const wantEnrich = opts?.enrich !== false;
  const { moments, engine } = wantEnrich
    ? await maybeEnrichSummaries(baseMoments)
    : { moments: baseMoments, engine: "heuristics" as const };

  const index: ArchiveIndexFile = {
    asOf: new Date().toISOString(),
    engine,
    momentCount: moments.length,
    moments,
    notes:
      engine === "llm"
        ? "Heuristics from FootageAsset markers + dive metadata; sample summaries polished with OpenAI."
        : "Heuristics-only index from FootageAsset markers + dive metadata (set OPENAI_API_KEY for optional LLM polish).",
  };

  if (!persistIndex(index)) {
    return { ok: false, error: "Could not write data/archive-index.json" };
  }
  return { ok: true, index };
}

export type ArchiveSearchFilters = {
  q?: string;
  athlete?: string;
  discipline?: string;
  marker?: string;
};

export function filterArchiveMoments(
  moments: ArchiveMoment[],
  filters: ArchiveSearchFilters,
): ArchiveMoment[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  const athlete = filters.athlete?.trim().toLowerCase() ?? "";
  const discipline = filters.discipline?.trim().toUpperCase() ?? "";
  const marker = filters.marker?.trim().toLowerCase() ?? "";

  return moments.filter((m) => {
    if (athlete) {
      const hit =
        m.athleteSlug.toLowerCase() === athlete ||
        m.athleteName.toLowerCase().includes(athlete);
      if (!hit) return false;
    }
    if (discipline && m.discipline.toUpperCase() !== discipline) return false;
    if (marker) {
      const kind = String(m.markerKind).toLowerCase();
      const label = m.markerLabel.toLowerCase();
      const markerHit =
        kind === marker ||
        label === marker ||
        kind.includes(marker) ||
        label.includes(marker) ||
        (marker === "bo" && (kind === "blackout" || kind === "bo"));
      if (!markerHit) return false;
    }
    if (!q) return true;
    const hay = [
      m.title,
      m.summary,
      m.athleteName,
      m.athleteSlug,
      m.discipline,
      m.eventName,
      m.markerKind,
      m.markerLabel,
      ...m.tags,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function listArchiveFacets(moments: ArchiveMoment[]): {
  athletes: Array<{ slug: string; name: string; count: number }>;
  disciplines: Array<{ id: string; count: number }>;
  markers: Array<{ id: string; count: number }>;
} {
  const athletes = new Map<string, { slug: string; name: string; count: number }>();
  const disciplines = new Map<string, number>();
  const markers = new Map<string, number>();

  for (const m of moments) {
    const a = athletes.get(m.athleteSlug) ?? {
      slug: m.athleteSlug,
      name: m.athleteName,
      count: 0,
    };
    a.count += 1;
    athletes.set(m.athleteSlug, a);

    disciplines.set(m.discipline, (disciplines.get(m.discipline) ?? 0) + 1);

    const kind = String(m.markerKind);
    markers.set(kind, (markers.get(kind) ?? 0) + 1);
  }

  return {
    athletes: [...athletes.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    disciplines: [...disciplines.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    markers: [...markers.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function fmtArchiveClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export const ARCHIVE_MARKER_KINDS: FootageMarkerKind[] = [
  "start",
  "turn",
  "surface",
  "protocol",
  "penalty",
  "blackout",
  "card",
];
