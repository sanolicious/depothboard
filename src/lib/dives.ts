import { fmtValue } from "@/lib/format";
import {
  hasPlayableFile,
  markersToDiveMarkers,
  resolveStorageUrl,
} from "@/lib/footage";
import type { Repository } from "@/lib/repository";
import type {
  Card,
  DiveMarker,
  FootageAsset,
  FootageQuality,
  ResultStatus,
  ShowcaseDive,
} from "@/types/domain";

/** Unified dive page model: showcase footage or performance-only result. */
export type DiveView = {
  id: string;
  athleteSlug: string;
  eventId: string;
  discipline: string;
  ap: number;
  rp: number;
  card: Card;
  date: string;
  day: number;
  ot: string;
  status: ResultStatus;
  wr?: boolean;
  title: string;
  durationSec: number;
  cameras: string[];
  markers: DiveMarker[];
  annotation: { type: "none" | "penalty" | "dq"; text: string };
  price: number;
  scene: { h: number; x: string; d: number };
  hasVideo: boolean;
  footageAssetId?: string;
  footageQuality?: FootageQuality;
  previewUrl?: string;
  posterUrl?: string;
  embedUrl?: string;
  footagePending: boolean;
  cmasEmbedOnly: boolean;
  markerSeek: Array<{ id: string; label: string; kind: string; atSec: number; at: number }>;
};

function sceneFromResult(rp: number, card: Card): { h: number; x: string; d: number } {
  const depth = card === "R" ? 160 : Math.min(240, 140 + Math.max(0, rp) * 0.35);
  return { h: depth, x: "52%", d: 0.48 };
}

function fromFootage(
  d: ShowcaseDive,
  primary: FootageAsset | undefined,
): DiveView {
  const playable = hasPlayableFile(primary);
  const cmasEmbedOnly =
    primary?.rightsModel === "cmas_link" || !!primary?.embedUrl && !playable;
  const markerSeek =
    primary && playable
      ? primary.markers.map((m) => ({
          id: m.id,
          label: m.label,
          kind: m.kind,
          atSec: m.atSec,
          at: m.at,
        }))
      : d.markers.map((m) => ({
          id: m.id,
          label: m.label,
          kind: m.kind,
          atSec: Math.round(m.at * (d.durationSec || 1)),
          at: m.at,
        }));

  return {
    ...d,
    hasVideo: playable,
    footageAssetId: primary?.id ?? d.footageAssetId,
    footageQuality: primary?.quality ?? d.footageQuality,
    previewUrl:
      d.previewUrl ?? resolveStorageUrl(primary?.storageKey) ?? undefined,
    posterUrl:
      d.posterUrl ?? resolveStorageUrl(primary?.posterKey) ?? undefined,
    embedUrl: primary?.embedUrl ?? d.embedUrl,
    footagePending: !playable && !cmasEmbedOnly,
    cmasEmbedOnly: !!cmasEmbedOnly,
    markerSeek,
    markers: playable
      ? primary
        ? markersToDiveMarkers(primary.markers)
        : d.markers
      : [],
    cameras: playable ? (primary?.cameras ?? d.cameras) : [],
    durationSec: playable ? (primary?.durationSec ?? d.durationSec) : 0,
  };
}

function fromShowcase(d: ShowcaseDive, primary?: FootageAsset): DiveView {
  if (primary || d.footageAssetId || d.previewUrl) {
    return fromFootage(d, primary);
  }
  // Legacy showcase without FootageAsset catalog entry.
  const hasVideo = d.durationSec > 0 || d.cameras.length > 0;
  return {
    ...d,
    hasVideo,
    footagePending: !hasVideo,
    cmasEmbedOnly: false,
    markerSeek: d.markers.map((m) => ({
      id: m.id,
      label: m.label,
      kind: m.kind,
      atSec: Math.round(m.at * (d.durationSec || 1)),
      at: m.at,
    })),
  };
}

export function resolveDive(repo: Repository, id: string): DiveView | undefined {
  const primary = repo.getPrimaryFootage(id);
  const showcase = repo.getShowcaseDive(id);
  if (showcase) return fromShowcase(showcase, primary);

  const perf = repo.getPerformanceByDiveId(id);
  if (!perf) return undefined;

  // Performance with footage linked only via catalog (no showcase row yet).
  if (primary) {
    const synthetic: ShowcaseDive = {
      id: perf.diveId,
      athleteSlug: perf.athleteSlug,
      eventId: perf.eventId,
      discipline: perf.discipline,
      ap: perf.ap,
      rp: perf.rp,
      card: perf.card,
      date: perf.date,
      day: perf.day,
      ot: perf.ot,
      status: perf.status,
      wr: perf.wr,
      title: `${repo.getAthleteBySlug(perf.athleteSlug)?.name ?? "Athlete"} · ${perf.discipline}`,
      durationSec: primary.durationSec,
      cameras: primary.cameras,
      markers: markersToDiveMarkers(primary.markers),
      annotation: primary.annotation ?? {
        type: "none",
        text: "Diveye footage linked via OT match.",
      },
      price: primary.priceEur ?? 29,
      scene: primary.scene ?? sceneFromResult(perf.rp, perf.card),
      footageAssetId: primary.id,
      footageQuality: primary.quality,
      previewUrl: resolveStorageUrl(primary.storageKey),
      posterUrl: resolveStorageUrl(primary.posterKey),
      embedUrl: primary.embedUrl,
    };
    return fromFootage(synthetic, primary);
  }

  const athlete = repo.getAthleteBySlug(perf.athleteSlug);
  const resultLabel =
    perf.card === "R" ? "DQ" : fmtValue(perf.discipline, perf.rp);
  const name = athlete?.name ?? "Athlete";

  let annotation: DiveView["annotation"] = {
    type: "none",
    text: "Official result from federation ingest. Diveye footage and OT markers will appear here when the archive is linked.",
  };
  if (perf.card === "Y") {
    annotation = {
      type: "penalty",
      text: "Yellow card recorded in source results. Full judges' annotation awaits Diveye OT linkage.",
    };
  } else if (perf.card === "R") {
    annotation = {
      type: "dq",
      text: "Red card / DQ in source results. Full judges' annotation awaits Diveye OT linkage.",
    };
  }

  return {
    id: perf.diveId,
    athleteSlug: perf.athleteSlug,
    eventId: perf.eventId,
    discipline: perf.discipline,
    ap: perf.ap,
    rp: perf.rp,
    card: perf.card,
    date: perf.date,
    day: perf.day,
    ot: perf.ot,
    status: perf.status,
    wr: perf.wr,
    title: `${name} · ${perf.discipline} ${resultLabel}`,
    durationSec: 0,
    cameras: [],
    markers: [],
    annotation,
    price: 29,
    scene: sceneFromResult(perf.rp, perf.card),
    hasVideo: false,
    footagePending: true,
    cmasEmbedOnly: false,
    markerSeek: [],
  };
}
