import { fmtValue } from "@/lib/format";
import type { Repository } from "@/lib/repository";
import type {
  Card,
  DiveMarker,
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
};

function sceneFromResult(rp: number, card: Card): { h: number; x: string; d: number } {
  const depth = card === "R" ? 160 : Math.min(240, 140 + Math.max(0, rp) * 0.35);
  return { h: depth, x: "52%", d: 0.48 };
}

function fromShowcase(d: ShowcaseDive): DiveView {
  // CMAS embed-only rows may sit in showcase for rights demos without Diveye files.
  const hasVideo = d.durationSec > 0 || d.cameras.length > 0;
  return { ...d, hasVideo };
}

export function resolveDive(repo: Repository, id: string): DiveView | undefined {
  const showcase = repo.getShowcaseDive(id);
  if (showcase) return fromShowcase(showcase);

  const perf = repo.getPerformanceByDiveId(id);
  if (!perf) return undefined;

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
  };
}
