import type {
  Athlete,
  Performance,
  RankingOpts,
  RankingRow,
  SeedDb,
  Sex,
} from "@/types/domain";

/** AIDA / Portal Points factors (FR-compatible). */
const FACTOR: Record<string, number> = {
  CWT: 1,
  CWTB: 1,
  CNF: 1,
  FIM: 1,
  STA: 0.2,
  DYN: 0.5,
  DYNB: 0.5,
  DNF: 0.5,
};

const SETS: Record<string, string[]> = {
  OVERALL: ["CWT", "CWTB", "CNF", "FIM", "STA", "DYN", "DYNB", "DNF"],
  DEPTH: ["CWT", "CWTB", "CNF", "FIM"],
  POOL: ["STA", "DYN", "DYNB", "DNF"],
};

/** Rolling Active window length (months), aligned with product ACTIVE24. */
const ACTIVE_MONTHS = 24;

function monthsAgo(asOf: string, months: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function inScope(
  date: string,
  scope: RankingOpts["scope"],
  asOf: string,
): boolean {
  if (scope === "all") return true;
  if (scope === "season") {
    const year = asOf.slice(0, 4);
    return date >= `${year}-01-01` && date <= asOf;
  }
  // active = last 24 months up to asOf
  return date >= monthsAgo(asOf, ACTIVE_MONTHS) && date <= asOf;
}

function disciplinesOf(sel: RankingOpts["disc"]): string[] {
  return SETS[sel] ?? [sel];
}

/** Prefer federation points (already after yellow-card penalties); else factor × RP. */
function pointsOf(att: Performance): number {
  if (typeof att.points === "number" && Number.isFinite(att.points)) {
    return Math.floor(att.points * 10) / 10;
  }
  const f = FACTOR[att.discipline] ?? 1;
  return Math.floor(att.rp * f * 10) / 10;
}

function isFrSource(att: Performance): boolean {
  return (att.source || "").toUpperCase() === "FR";
}

function bests(
  athleteId: string,
  performances: Performance[],
  opts: RankingOpts,
  asOf: string,
): Record<string, Performance> {
  const out: Record<string, Performance> = {};
  for (const att of performances) {
    if (att.athleteId !== athleteId) continue;
    // Rankings only count jury-confirmed rows (spec: LIVE/UNOFFICIAL stay out).
    if (att.status && att.status !== "official") continue;
    // Federation boards stay AIDA/CMAS-only — FR gap-fill is Portal only.
    if (opts.board !== "PORTAL") {
      if (att.federation !== opts.board) continue;
      if (isFrSource(att)) continue;
    }
    if (!inScope(att.date, opts.scope, asOf)) continue;
    // RED / DQ = 0 pts, never a PB. Card comes from the judging federation.
    if (att.card === "R") continue;
    if (!(att.discipline in FACTOR)) continue;
    const cur = out[att.discipline];
    if (!cur) {
      out[att.discipline] = att;
      continue;
    }
    const aPts = pointsOf(att);
    const cPts = pointsOf(cur);
    if (aPts > cPts) {
      out[att.discipline] = att;
    } else if (aPts === cPts && isFrSource(cur) && !isFrSource(att)) {
      // Prefer AIDA/CMAS provenance when points tie.
      out[att.discipline] = att;
    }
  }
  return out;
}

function bestPct(row: Omit<RankingRow, "pos">, wr: SeedDb["wr"]): number {
  let best = 0;
  for (const [d, att] of Object.entries(row.best)) {
    const w = wr[row.athlete.sex as Sex]?.[d];
    if (!w) continue;
    best = Math.max(best, att.rp / w);
  }
  return best;
}

function earliestPbDate(best: Record<string, Performance>): string {
  let min = "9999-99-99";
  for (const att of Object.values(best)) {
    if (att.date < min) min = att.date;
  }
  return min;
}

export function computeRanking(db: SeedDb, opts: RankingOpts): RankingRow[] {
  const discs = disciplinesOf(opts.disc);
  const asOf = db.asOf || "2026-11-26";
  const rows: Omit<RankingRow, "pos">[] = [];

  for (const a of db.athletes) {
    if (a.sex !== opts.sex) continue;
    if (opts.country && opts.country !== "ALL" && a.country !== opts.country) continue;
    if (a.minor && !opts.includeMinors) continue;

    const b = bests(a.id, db.performances, opts, asOf);
    let total = 0;
    let pct = 0;
    let count = 0;
    for (const d of discs) {
      const hit = b[d];
      if (!hit) continue;
      total += pointsOf(hit);
      const wr = db.wr[a.sex as Sex]?.[d];
      if (wr) pct += hit.rp / wr;
      count++;
    }
    if (!count) continue;
    rows.push({
      athlete: a,
      best: b,
      total: Math.floor(total * 10) / 10,
      pct: (pct / discs.length) * 100,
      count,
    });
  }

  const key = opts.metric === "pct" ? "pct" : "total";
  rows.sort((x, y) => {
    const primary = y[key] - x[key];
    if (Math.abs(primary) > 1e-9) return primary;
    // Tie-break (product spec 4.3): higher single %WR, then more discs, then earlier last PB date
    const pb = bestPct(y, db.wr) - bestPct(x, db.wr);
    if (Math.abs(pb) > 1e-12) return pb;
    if (y.count !== x.count) return y.count - x.count;
    return earliestPbDate(x.best).localeCompare(earliestPbDate(y.best));
  });

  // Olympic ranking for equal primary score (1, 2, 2, 4) — FR/AIDA style for display ties
  const ranked: RankingRow[] = [];
  let prev: RankingRow | null = null;
  rows.forEach((r, i) => {
    const tied =
      prev &&
      Math.abs(prev[key] - r[key]) < 1e-9;
    const pos = tied ? prev!.pos : i + 1;
    const row = { ...r, pos };
    ranked.push(row);
    prev = row;
  });
  return ranked;
}

export function athleteRank(
  db: SeedDb,
  athlete: Athlete,
  board: RankingOpts["board"] = "PORTAL",
): number | null {
  const rows = computeRanking(db, {
    board,
    sex: athlete.sex,
    disc: "OVERALL",
    scope: "active",
    metric: "points",
    includeMinors: athlete.minor,
  });
  return rows.find((r) => r.athlete.id === athlete.id)?.pos ?? null;
}
