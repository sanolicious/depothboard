import "server-only";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type {
  DiveMarker,
  FootageAsset,
  FootageMarker,
  FootageQuality,
  Performance,
  Product,
  ShowcaseDive,
} from "@/types/domain";

export type FootageCatalog = {
  asOf: string;
  storageAdapter: string;
  notes?: string;
  keyMap: Record<string, string>;
  assets: FootageAsset[];
};

const DEFAULT_KEY_MAP: Record<string, string> = {
  "local:preview/shared.mp4": "/video/hero.mp4",
  "local:hq/shared.mp4": "/video/hero.mp4",
  "local:poster/shared.jpg": "/video/poster.jpg",
};

let catalogCache: FootageCatalog | null = null;

export function loadFootageCatalog(): FootageCatalog {
  if (catalogCache) return catalogCache;
  const file = path.join(process.cwd(), "data", "footage.json");
  if (!existsSync(file)) {
    catalogCache = {
      asOf: "",
      storageAdapter: "local-mock",
      keyMap: DEFAULT_KEY_MAP,
      assets: [],
    };
    return catalogCache;
  }
  const raw = JSON.parse(readFileSync(file, "utf8")) as FootageCatalog;
  catalogCache = {
    ...raw,
    keyMap: { ...DEFAULT_KEY_MAP, ...(raw.keyMap ?? {}) },
    assets: raw.assets ?? [],
  };
  return catalogCache;
}

/** Drop catalog cache (tests / hot reload). */
export function invalidateFootageCatalog(): void {
  catalogCache = null;
}

/** Parse OT / officialTop clock to minutes from midnight. */
export function parseOtToMinutes(ot: string): number | null {
  const s = (ot || "").trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  return null;
}

export function otWithinTolerance(
  officialTop: string,
  performanceOt: string,
  toleranceMin: number,
): boolean {
  const a = parseOtToMinutes(officialTop);
  const b = parseOtToMinutes(performanceOt);
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= toleranceMin;
}

/**
 * Match a FootageAsset to a performance: strong diveId first, else
 * athlete + event + discipline + officialTop within OT tolerance.
 */
export function matchFootageToPerformance(
  asset: FootageAsset,
  performances: Performance[],
): Performance | undefined {
  if (asset.performanceDiveId) {
    const byId = performances.find((p) => p.diveId === asset.performanceDiveId);
    if (byId) return byId;
  }
  const candidates = performances.filter(
    (p) =>
      p.athleteSlug === asset.athleteSlug &&
      p.eventId === asset.eventId &&
      p.discipline === asset.discipline &&
      otWithinTolerance(asset.officialTop, p.ot, asset.otToleranceMin),
  );
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    // Prefer exact OT string match, then earliest diveId for stability.
    const exact = candidates.filter((p) => p.ot === asset.officialTop);
    const pool = exact.length ? exact : candidates;
    return [...pool].sort((a, b) => a.diveId.localeCompare(b.diveId))[0];
  }
  return undefined;
}

/** Resolve a storageKey to a public URL (mock local map; S3 later). */
export function resolveStorageUrl(
  storageKey: string | undefined,
  catalog: FootageCatalog = loadFootageCatalog(),
): string | undefined {
  if (!storageKey) return undefined;
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return storageKey;
  }
  if (storageKey.startsWith("/")) return storageKey;
  return catalog.keyMap[storageKey];
}

export function markersToDiveMarkers(markers: FootageMarker[]): DiveMarker[] {
  return markers.map((m) => ({
    id: m.id,
    label: m.label,
    at: m.at,
    kind: m.kind === "blackout" ? "bo" : m.kind,
  }));
}

/** Prefer preview asset for a dive; fall back to HQ. */
export function pickDisplayAsset(
  assets: FootageAsset[],
  diveId: string,
): FootageAsset | undefined {
  const forDive = assets.filter(
    (a) =>
      a.performanceDiveId === diveId ||
      /* matched id may be filled later */ false,
  );
  const linked = forDive.length
    ? forDive
    : assets.filter((a) => a.performanceDiveId === diveId);
  const preview = linked.find((a) => a.quality === "preview");
  return preview ?? linked[0];
}

export function listAssetsForDive(
  assets: FootageAsset[],
  diveId: string,
): FootageAsset[] {
  return assets.filter((a) => a.performanceDiveId === diveId);
}

export function hasPlayableFile(asset: FootageAsset | undefined): boolean {
  if (!asset) return false;
  if (asset.rightsModel === "cmas_link") return false;
  return !!asset.storageKey && asset.durationSec > 0;
}

/** Build / refresh ShowcaseDive rows from matched footage + performances. */
export function showcaseFromFootage(
  performances: Performance[],
  assets: FootageAsset[],
  athleteName: (slug: string) => string,
): ShowcaseDive[] {
  const byDive = new Map<string, FootageAsset[]>();
  for (const asset of assets) {
    const perf = matchFootageToPerformance(asset, performances);
    const diveId = perf?.diveId ?? asset.performanceDiveId;
    if (!diveId) continue;
    // Stamp strong link for downstream consumers.
    asset.performanceDiveId = diveId;
    const list = byDive.get(diveId) ?? [];
    list.push(asset);
    byDive.set(diveId, list);
  }

  const out: ShowcaseDive[] = [];
  for (const [diveId, list] of byDive) {
    const preview =
      list.find((a) => a.quality === "preview") ??
      list.find((a) => a.quality === "hq") ??
      list[0];
    const perf = performances.find((p) => p.diveId === diveId);
    if (!perf || !preview) continue;

    const playable = hasPlayableFile(preview);
    const resultLabel =
      perf.card === "R" ? "DQ" : `${perf.rp}${perf.discipline === "STA" ? "s" : "m"}`;
    const name = athleteName(perf.athleteSlug);

    out.push({
      id: diveId,
      athleteSlug: perf.athleteSlug,
      eventId: perf.eventId,
      discipline: perf.discipline,
      ap: perf.ap,
      rp: perf.rp,
      card: perf.card,
      date: perf.date,
      day: perf.day,
      ot: perf.ot || preview.officialTop,
      status: perf.status,
      wr: perf.wr,
      title: `${name} · ${perf.discipline} ${resultLabel}`,
      durationSec: playable ? preview.durationSec : 0,
      cameras: playable ? preview.cameras : [],
      markers: playable ? markersToDiveMarkers(preview.markers) : [],
      annotation: preview.annotation ?? {
        type: "none",
        text:
          preview.rightsModel === "cmas_link"
            ? "CMAS rights: embed / link only."
            : "Diveye footage linked.",
      },
      price: preview.priceEur ?? 29,
      scene: preview.scene ?? { h: 200, x: "50%", d: 0.45 },
      licenseTier: "social",
      footageAssetId: preview.id,
      footageQuality: preview.quality,
      storageKey: preview.storageKey || undefined,
      previewUrl: resolveStorageUrl(preview.storageKey),
      posterUrl: resolveStorageUrl(preview.posterKey),
      embedUrl: preview.embedUrl,
    });
  }
  return out;
}

type FunnelSku = "sample" | "short" | "watermark" | "social" | "hq" | "commercial";

const TIER_META: Record<
  FunnelSku,
  {
    licenseTier: Product["licenseTier"];
    price: number;
    label: string;
    description: string;
    delivery: string;
  }
> = {
  sample: {
    licenseTier: "sample",
    price: 0,
    label: "sample",
    description:
      "Free watermarked sample — Diveye OT footage + athlete publication consent.",
    delivery: "Instant download / stream placeholder",
  },
  short: {
    licenseTier: "short",
    price: 9,
    label: "short access",
    description: "48 h watermarked short access to the OT clip.",
    delivery: "Watermarked stream link · 48 h stub",
  },
  watermark: {
    licenseTier: "watermark",
    price: 19,
    label: "long / watermark",
    description: "Full-length watermarked stream (personal viewing).",
    delivery: "Watermarked stream + placeholder file",
  },
  social: {
    licenseTier: "social",
    price: 29,
    label: "social",
    description: "Social licence (vertical + horizontal) with result overlay.",
    delivery: "Instant placeholder download after pay",
  },
  hq: {
    licenseTier: "master",
    price: 79,
    label: "HQ / master",
    description:
      "HQ / master from Diveye disk — montage after purchase, email when ready.",
    delivery: "Processing · email when ready (≈72 h)",
  },
  commercial: {
    licenseTier: "commercial",
    price: 129,
    label: "commercial quote",
    description:
      "Commercial / broadcast use — requires commercial consent; quote fulfilment.",
    delivery: "B2B quote · Diveye follows up by email",
  },
};

/**
 * Derive shop SKUs for the licence funnel on Diveye-owned assets with a
 * playable file. CMAS assets never produce products.
 */
export function productsFromFootage(
  assets: FootageAsset[],
  existing: Product[],
): Product[] {
  const diveIds = new Set(
    assets
      .filter((a) => a.rightsModel === "diveye_owned" && hasPlayableFile(a))
      .map((a) => a.performanceDiveId)
      .filter(Boolean) as string[],
  );

  const generated: Product[] = [];
  for (const diveId of diveIds) {
    const preview = listAssetsForDive(assets, diveId).find(
      (a) => a.quality === "preview",
    );
    const hq = listAssetsForDive(assets, diveId).find((a) => a.quality === "hq");
    if (!preview) continue;
    const base = `${preview.athleteSlug}-${preview.discipline}`.toLowerCase();
    const titleCore = `${preview.athleteSlug.replace(/-/g, " ")} · ${preview.discipline}`;

    const skus: FunnelSku[] = [
      "sample",
      "short",
      "watermark",
      "social",
      "hq",
      "commercial",
    ];
    for (const sku of skus) {
      if (sku === "hq" && !hq) continue;
      const meta = TIER_META[sku];
      const id = `prod-ft-${diveId}-${sku}`;
      const price =
        sku === "sample"
          ? 0
          : sku === "hq"
            ? (hq?.priceEur ?? meta.price)
            : sku === "social"
              ? (preview.priceEur ?? meta.price)
              : meta.price;
      generated.push({
        id,
        slug: `${base}-${diveId}-${sku}`,
        name: `${titleCore} · ${meta.label}`,
        kind: "clip",
        price,
        description: meta.description,
        delivery: meta.delivery,
        licenseTier: meta.licenseTier,
        diveId,
        saleEnabled: true,
      });
    }
  }

  // Keep media-pack / non-dive overlay products; dive SKUs come from footage.
  const overlayKeep = existing.filter((p) => !p.diveId || p.kind === "media");
  const byId = new Map<string, Product>();
  for (const p of [...overlayKeep, ...generated]) byId.set(p.id, p);
  return [...byId.values()];
}

export function searchFootageByMarker(
  dives: ShowcaseDive[],
  q: string,
): ShowcaseDive[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return dives;
  return dives.filter((d) => {
    const markerHay = d.markers
      .map((m) => `${m.label} ${m.kind}`)
      .join(" ")
      .toLowerCase();
    return (
      markerHay.includes(needle) ||
      d.title.toLowerCase().includes(needle) ||
      d.discipline.toLowerCase().includes(needle) ||
      d.athleteSlug.includes(needle)
    );
  });
}

export function qualityLabel(q: FootageQuality | undefined): string {
  if (q === "hq") return "HQ";
  if (q === "preview") return "Preview";
  return "Footage";
}
