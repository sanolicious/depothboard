import "server-only";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type {
  FederationJudgesCatalog,
  FootageAsset,
  FootageMarker,
  JudgeEvidencePack,
  JudgeTrainingCase,
} from "@/types/domain";
import { loadFootageCatalog, resolveStorageUrl } from "@/lib/footage";

export {
  ALL_JUDGE_TAGS,
  JUDGE_TAG_LABELS,
  scoreJudgeQuiz,
  type QuizScore,
} from "@/lib/federation-score";

let catalogCache: FederationJudgesCatalog | null = null;

const EMPTY: FederationJudgesCatalog = {
  asOf: "",
  materials: [],
  evidencePacks: [],
  trainingCases: [],
};

export function loadFederationJudges(): FederationJudgesCatalog {
  if (catalogCache) return catalogCache;
  const file = path.join(process.cwd(), "data", "federation-judges.json");
  if (!existsSync(file)) {
    catalogCache = EMPTY;
    return catalogCache;
  }
  try {
    const parsed = JSON.parse(
      readFileSync(file, "utf8"),
    ) as FederationJudgesCatalog;
    catalogCache = {
      asOf: parsed.asOf ?? "",
      notes: parsed.notes,
      materials: parsed.materials ?? [],
      evidencePacks: parsed.evidencePacks ?? [],
      trainingCases: parsed.trainingCases ?? [],
    };
  } catch {
    catalogCache = EMPTY;
  }
  return catalogCache;
}

export function invalidateFederationJudgesCache(): void {
  catalogCache = null;
}

export function listTrainingCases(): JudgeTrainingCase[] {
  return loadFederationJudges().trainingCases;
}

export function getTrainingCase(id: string): JudgeTrainingCase | undefined {
  return listTrainingCases().find((c) => c.id === id);
}

export function listEvidencePacks(): JudgeEvidencePack[] {
  return loadFederationJudges().evidencePacks;
}

export function getEvidencePack(id: string): JudgeEvidencePack | undefined {
  return listEvidencePacks().find((p) => p.id === id);
}

export function listMaterials() {
  return loadFederationJudges().materials;
}

export type ResolvedEvidencePack = {
  pack: JudgeEvidencePack;
  asset: FootageAsset | null;
  markers: FootageMarker[];
  previewUrl?: string;
  posterUrl?: string;
  embedUrl?: string;
};

export function resolveEvidencePack(id: string): ResolvedEvidencePack | null {
  const pack = getEvidencePack(id);
  if (!pack) return null;
  const catalog = loadFootageCatalog();
  const asset =
    catalog.assets.find((a) => a.id === pack.footageAssetId) ?? null;
  const markers = asset
    ? asset.markers.filter((m) => pack.markerIds.includes(m.id))
    : [];
  return {
    pack,
    asset,
    markers,
    previewUrl: asset
      ? resolveStorageUrl(asset.storageKey, catalog)
      : undefined,
    posterUrl: asset?.posterKey
      ? resolveStorageUrl(asset.posterKey, catalog)
      : undefined,
    embedUrl: asset?.embedUrl,
  };
}
