import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  CoachAthleteLink,
  CoachFinding,
  CoachReport,
  CoachReportEngine,
  FootageAsset,
  FootageMarker,
  Performance,
  SessionUser,
} from "@/types/domain";
import { resolveDive } from "@/lib/dives";
import { getRepository } from "@/lib/repository";
import { ownsAthlete } from "@/lib/auth";

export const COACH_DISCLAIMER =
  "Training aid only — not medical advice and not a substitute for in-water safety, a qualified coach, or federation rules. Blackout / BO markers are observational cues from footage, not a clinical diagnosis.";

const REPORTS_FILE = "coach-reports.json";
const LINKS_FILE = "coach-links.json";

let reportsCache: CoachReport[] | null = null;
let linksCache: CoachAthleteLink[] | null = null;

function reportsPath() {
  return path.join(process.cwd(), "data", REPORTS_FILE);
}

function linksPath() {
  return path.join(process.cwd(), "data", LINKS_FILE);
}

function readReports(): CoachReport[] {
  if (reportsCache) return reportsCache;
  const file = reportsPath();
  if (!existsSync(file)) {
    reportsCache = [];
    return reportsCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as CoachReport[];
    reportsCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    reportsCache = [];
  }
  return reportsCache;
}

function persistReports(reports: CoachReport[]): boolean {
  try {
    writeFileSync(
      reportsPath(),
      JSON.stringify(reports, null, 2) + "\n",
      "utf8",
    );
    reportsCache = reports;
    return true;
  } catch {
    return false;
  }
}

export function invalidateCoachCache(): void {
  reportsCache = null;
  linksCache = null;
}

function readLinks(): CoachAthleteLink[] {
  if (linksCache) return linksCache;
  const file = linksPath();
  if (!existsSync(file)) {
    linksCache = [];
    return linksCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as CoachAthleteLink[];
    linksCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    linksCache = [];
  }
  return linksCache;
}

export function listCoachLinks(opts?: {
  coachUserId?: string;
  athleteSlug?: string;
  activeOnly?: boolean;
}): CoachAthleteLink[] {
  let list = readLinks();
  if (opts?.coachUserId) {
    list = list.filter((l) => l.coachUserId === opts.coachUserId);
  }
  if (opts?.athleteSlug) {
    list = list.filter((l) => l.athleteSlug === opts.athleteSlug);
  }
  if (opts?.activeOnly !== false) {
    list = list.filter((l) => l.status === "active");
  }
  return list;
}

export function isLinkedCoach(
  session: SessionUser | null | undefined,
  athleteSlug: string | null | undefined,
): boolean {
  if (!session || !athleteSlug) return false;
  if (session.role !== "coach" && session.role !== "admin") return false;
  if (session.role === "admin") return true;
  return listCoachLinks({
    coachUserId: session.id,
    athleteSlug,
    activeOnly: true,
  }).some((l) => l.status === "active");
}

/** Athlete owner or linked coach (or admin). */
export function canViewCoachReports(
  session: SessionUser | null | undefined,
  athleteSlug: string | null | undefined,
): boolean {
  if (!session || !athleteSlug) return false;
  if (ownsAthlete(session, athleteSlug)) return true;
  return isLinkedCoach(session, athleteSlug);
}

/** Logged-in athlete who owns the dive, or admin. Coaches view but do not trigger analyze. */
export function canAnalyzeDive(
  session: SessionUser | null | undefined,
  athleteSlug: string | null | undefined,
): boolean {
  if (!session || !athleteSlug) return false;
  if (session.role === "admin") return true;
  return ownsAthlete(session, athleteSlug);
}

export function listCoachReportsVisibleTo(
  session: SessionUser,
): CoachReport[] {
  const all = readReports();
  return all
    .filter((r) => canViewCoachReports(session, r.athleteSlug))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCoachReport(
  id: string,
  session: SessionUser,
): CoachReport | undefined {
  const report = readReports().find((r) => r.id === id);
  if (!report) return undefined;
  if (!canViewCoachReports(session, report.athleteSlug)) return undefined;
  return report;
}

export function listReportsForDive(
  diveId: string,
  session: SessionUser,
): CoachReport[] {
  return listCoachReportsVisibleTo(session).filter((r) => r.diveId === diveId);
}

function markerByKind(
  markers: FootageMarker[],
  kind: FootageMarker["kind"],
): FootageMarker | undefined {
  return markers.find((m) => m.kind === kind);
}

function mockTelemetry(
  performance: Performance | undefined,
  dive: NonNullable<ReturnType<typeof resolveDive>>,
  footage: FootageAsset | undefined,
): NonNullable<CoachReport["telemetrySnapshot"]> {
  const markers = footage?.markers ?? [];
  const start = markerByKind(markers, "start");
  const turn = markerByKind(markers, "turn");
  const surface = markerByKind(markers, "surface");
  const protocol = markerByKind(markers, "protocol");
  const diveTimeSec =
    start && surface
      ? Math.max(0, surface.atSec - start.atSec)
      : footage?.durationSec ?? dive?.durationSec ?? undefined;

  const rp = performance?.rp ?? dive?.rp;
  const disc = performance?.discipline ?? dive?.discipline;
  const isPool =
    disc === "DYN" || disc === "DYNB" || disc === "DNF" || disc === "STA";

  return {
    maxDepthM:
      typeof rp === "number" && !isPool && performance?.card !== "R"
        ? rp
        : typeof rp === "number" && isPool
          ? undefined
          : undefined,
    diveTimeSec,
    turnAtSec: turn?.atSec,
    surfaceAtSec: surface?.atSec,
    protocolAtSec: protocol?.atSec,
  };
}

function buildHeuristicFindings(opts: {
  performance: Performance | undefined;
  dive: NonNullable<ReturnType<typeof resolveDive>>;
  footage: FootageAsset | undefined;
  telemetry: NonNullable<CoachReport["telemetrySnapshot"]>;
}): CoachFinding[] {
  const { performance, dive, footage, telemetry } = opts;
  const markers = footage?.markers ?? [];
  const findings: CoachFinding[] = [];
  let n = 0;
  const push = (
    kind: CoachFinding["kind"],
    title: string,
    detail: string,
    extra?: { markerId?: string; atSec?: number },
  ) => {
    n += 1;
    findings.push({
      id: `f-${n}`,
      kind,
      title,
      detail,
      ...extra,
    });
  };

  const start = markerByKind(markers, "start");
  const turn = markerByKind(markers, "turn");
  const surface = markerByKind(markers, "surface");
  const protocol = markerByKind(markers, "protocol");
  const penalty = markerByKind(markers, "penalty");
  const blackout = markerByKind(markers, "blackout");
  const cardMark = markerByKind(markers, "card");

  const card = performance?.card ?? dive.card;
  const disc = performance?.discipline ?? dive.discipline;

  if (card === "W" && !penalty && !blackout) {
    push(
      "strength",
      "Clean judged outcome",
      `${disc} finished with a white card${cardMark ? ` (marker “${cardMark.label}”)` : ""}. Keep the same start composure and surface routine.`,
      cardMark
        ? { markerId: cardMark.id, atSec: cardMark.atSec }
        : undefined,
    );
  }

  if (start && turn && telemetry.diveTimeSec && telemetry.diveTimeSec > 0) {
    const descentShare = (turn.atSec - start.atSec) / telemetry.diveTimeSec;
    if (descentShare >= 0.35 && descentShare <= 0.55) {
      turnBalanceStrength(push, turn, descentShare);
    } else if (descentShare > 0.55) {
      push(
        "issue",
        "Late turn relative to dive time",
        `Turn at ${turn.atSec}s is ~${Math.round(descentShare * 100)}% of dive time — descent may be slow or bottom time long. Review kick rate into the turn.`,
        { markerId: turn.id, atSec: turn.atSec },
      );
      push(
        "drill",
        "Turn-window pacing",
        "In the pool or on a short line: 4× half-distance with a fixed turn-at clock (±2 s). Log descent vs ascent split.",
      );
    } else if (descentShare < 0.35) {
      push(
        "issue",
        "Early turn / short descent phase",
        `Turn arrives early (~${Math.round(descentShare * 100)}% of dive time). Check announced depth/distance vs realised pacing.`,
        { markerId: turn.id, atSec: turn.atSec },
      );
      push(
        "drill",
        "Descent lengthener",
        "3× progressive distance with a metronome kick; delay the turn cue by one cycle each round.",
      );
    }
  }

  if (surface && protocol) {
    const gap = protocol.atSec - surface.atSec;
    if (gap <= 12) {
      push(
        "strength",
        "Tight surface protocol window",
        `Protocol marker ${gap}s after surface — efficient OK sequence under the OT clock.`,
        { markerId: protocol.id, atSec: protocol.atSec },
      );
    } else if (gap > 18) {
      push(
        "issue",
        "Slow surface-to-protocol",
        `${gap}s between surface and protocol markers. Judges may see hesitation; rehearse remove mask → OK → tag under fatigue.`,
        { markerId: protocol.id, atSec: protocol.atSec },
      );
      push(
        "drill",
        "Surface protocol ladder",
        "Dry: 5× (breath-hold exit → mask off → OK → tag) with a 3-breath recovery. Then 3× after a hard swim.",
      );
    }
  } else if (surface && !protocol) {
    push(
      "issue",
      "Missing protocol marker",
      "Surface is tagged but no protocol marker — either footage incomplete or protocol was late/missed. Re-watch surface cameras.",
      { markerId: surface.id, atSec: surface.atSec },
    );
  }

  if (penalty) {
    push(
      "issue",
      "Penalty marker on timeline",
      `OT tagged “${penalty.label}” at ${penalty.atSec}s. Review that camera angle with your coach before the next announcement.`,
      { markerId: penalty.id, atSec: penalty.atSec },
    );
    push(
      "drill",
      "Rule-spot rehearsal",
      "Watch the penalty window at 0.25× with notes: lane/line contact, early start, or grab. Repeat the clean alternative 5× dry.",
    );
  }

  if (blackout) {
    push(
      "issue",
      "Blackout-watch marker (observational)",
      `Footage has a BO-watch cue at ${blackout.atSec}s. Treat this as a training flag only — debrief with a safety-aware coach; do not self-diagnose.`,
      { markerId: blackout.id, atSec: blackout.atSec },
    );
    push(
      "drill",
      "Conservative recovery set",
      "Next session: shorter AP (−10–15%) with a buddy focus on surface recovery. Skip depth progressions until the coach clears them.",
    );
  }

  if (card === "Y") {
    push(
      "issue",
      "Yellow card on result",
      "Federation result is yellow. Cross-check AP→RP and surface protocol against the judges’ annotation.",
    );
  }

  if (card === "R") {
    push(
      "issue",
      "Red card / DQ",
      "Result is DQ. Use the dive page annotation and markers to isolate the rule breach before re-attempting.",
    );
    push(
      "drill",
      "Rule-check dry run",
      "With a coach: walk the exact DQ clause, then film one legal dry or shallow rehearsal of the fix.",
    );
  }

  const ap = performance?.ap ?? dive.ap;
  const rp = performance?.rp ?? dive.rp;
  if (
    typeof ap === "number" &&
    typeof rp === "number" &&
    card !== "R" &&
    ap > 0
  ) {
    const ratio = rp / ap;
    if (ratio >= 0.98 && ratio <= 1.02) {
      push(
        "strength",
        "AP ↔ RP alignment",
        `Realised ${rp} is within 2% of announced ${ap} — announcement discipline looks solid.`,
      );
    } else if (ratio < 0.9) {
      push(
        "issue",
        "Under-realised vs AP",
        `RP ${rp} vs AP ${ap} (~${Math.round(ratio * 100)}%). Consider a more conservative announcement or pacing review.`,
      );
      push(
        "drill",
        "Announcement calibration",
        "Log 5 training maxes; announce 90% of the median and film whether RP lands inside ±5%.",
      );
    } else if (ratio > 1.08) {
      push(
        "strength",
        "Over-performed announcement",
        `RP ${rp} beat AP ${ap}. Keep the buffer when conditions are uncertain; tighten only when form is repeatable.`,
      );
    }
  }

  if (!footage) {
    push(
      "issue",
      "No FootageAsset linked",
      "Analysis used result metadata only. Link Diveye OT footage for marker-based coaching.",
    );
  } else if (markers.length === 0) {
    push(
      "issue",
      "Footage without markers",
      "Asset is linked but has no OT markers — export Diveye marker JSON for richer feedback.",
    );
  }

  if (findings.filter((f) => f.kind === "strength").length === 0) {
    push(
      "strength",
      "Session logged for review",
      "Report generated from available markers and result fields. Re-run after the next filmed dive to track deltas.",
    );
  }

  return findings;
}

function turnBalanceStrength(
  push: (
    kind: CoachFinding["kind"],
    title: string,
    detail: string,
    extra?: { markerId?: string; atSec?: number },
  ) => void,
  turn: FootageMarker,
  descentShare: number,
) {
  push(
    "strength",
    "Balanced turn timing",
    `Turn at ~${Math.round(descentShare * 100)}% of dive time — descent/ascent split looks controlled.`,
    { markerId: turn.id, atSec: turn.atSec },
  );
}

function templateSummary(
  dive: NonNullable<ReturnType<typeof resolveDive>>,
  findings: CoachFinding[],
): string {
  const strengths = findings.filter((f) => f.kind === "strength").length;
  const issues = findings.filter((f) => f.kind === "issue").length;
  const drills = findings.filter((f) => f.kind === "drill").length;
  return (
    `Heuristic coach pass on ${dive.discipline} (${dive.id}): ` +
    `${strengths} strength(s), ${issues} issue(s), ${drills} drill(s). ` +
    `Use the findings below with your coach — this is a training aid, not medical or safety advice.`
  );
}

async function maybeLlmPolish(
  summary: string,
  findings: CoachFinding[],
  diveLabel: string,
): Promise<{ summary: string; engine: CoachReportEngine }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { summary, engine: "template" };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_COACH_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are a freediving technique coach assistant. Rewrite the summary in 2–3 short sentences. Stay non-medical. Never claim diagnosis or safety clearance. Do not invent markers. End by reminding this is a training aid only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              dive: diveLabel,
              baselineSummary: summary,
              findings: findings.map((f) => ({
                kind: f.kind,
                title: f.title,
                detail: f.detail,
              })),
            }),
          },
        ],
      }),
    });
    if (!res.ok) {
      return { summary, engine: "heuristics" };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) return { summary, engine: "heuristics" };
    return { summary: text, engine: "llm" };
  } catch {
    return { summary, engine: "heuristics" };
  }
}

export type AnalyzeResult =
  | { ok: true; report: CoachReport }
  | { ok: false; error: string; status: number };

export async function analyzeDiveForSession(
  diveId: string,
  session: SessionUser,
): Promise<AnalyzeResult> {
  const repo = getRepository();
  const dive = resolveDive(repo, diveId);
  if (!dive) {
    return { ok: false, error: "Dive not found", status: 404 };
  }

  if (!canAnalyzeDive(session, dive.athleteSlug)) {
    return {
      ok: false,
      error: "Only the athlete owner (or admin) can run AI coach analysis",
      status: 403,
    };
  }

  const performance = repo.getPerformanceByDiveId(diveId);
  const footage =
    repo.getPrimaryFootage(diveId) ??
    (dive.footageAssetId
      ? repo.listFootageAssets().find((a) => a.id === dive.footageAssetId)
      : undefined);

  const telemetry = mockTelemetry(performance, dive, footage);
  const findings = buildHeuristicFindings({
    performance,
    dive,
    footage,
    telemetry,
  });
  const baseSummary = templateSummary(dive, findings);
  const polished = await maybeLlmPolish(
    baseSummary,
    findings,
    `${dive.title} · ${dive.discipline}`,
  );

  const report: CoachReport = {
    id: `CR-${Date.now().toString(36).toUpperCase()}`,
    diveId,
    performanceId: performance?.id,
    footageAssetId: footage?.id ?? dive.footageAssetId,
    athleteSlug: dive.athleteSlug,
    createdAt: new Date().toISOString(),
    createdByUserId: session.id,
    engine: polished.engine,
    summary: polished.summary,
    findings,
    telemetrySnapshot: telemetry,
    disclaimer: COACH_DISCLAIMER,
    visibility: "private",
  };

  const all = readReports();
  all.push(report);
  if (!persistReports(all)) {
    return { ok: false, error: "Could not persist coach report", status: 500 };
  }

  return { ok: true, report };
}
