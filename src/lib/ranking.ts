import type {
  Athlete,
  Performance,
  RankingOpts,
  RankingRow,
  SeedDb,
  Sex,
} from "@/types/domain";

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

const ACTIVE_FROM = "2024-11-17";

function inScope(date: string, scope: RankingOpts["scope"]): boolean {
  if (scope === "all") return true;
  if (scope === "season") return date >= "2026-01-01";
  return date >= ACTIVE_FROM;
}

function disciplinesOf(sel: RankingOpts["disc"]): string[] {
  return SETS[sel] ?? [sel];
}

function points(disc: string, v: number): number {
  return Math.floor(v * (FACTOR[disc] ?? 1) * 10) / 10;
}

function bests(
  athleteId: string,
  performances: Performance[],
  opts: RankingOpts,
): Record<string, Performance> {
  const out: Record<string, Performance> = {};
  for (const att of performances) {
    if (att.athleteId !== athleteId) continue;
    if (opts.board !== "PORTAL" && att.federation !== opts.board) continue;
    if (!inScope(att.date, opts.scope)) continue;
    if (att.card === "R") continue;
    const cur = out[att.discipline];
    if (!cur || att.rp > cur.rp) out[att.discipline] = att;
  }
  return out;
}

export function computeRanking(db: SeedDb, opts: RankingOpts): RankingRow[] {
  const discs = disciplinesOf(opts.disc);
  const rows: Omit<RankingRow, "pos">[] = [];

  for (const a of db.athletes) {
    if (a.sex !== opts.sex) continue;
    if (opts.country && opts.country !== "ALL" && a.country !== opts.country) continue;
    if (a.minor && !opts.includeMinors) continue;

    const b = bests(a.id, db.performances, opts);
    let total = 0;
    let pct = 0;
    let count = 0;
    for (const d of discs) {
      const hit = b[d];
      if (!hit) continue;
      total += points(d, hit.rp);
      pct += hit.rp / db.wr[a.sex as Sex][d];
      count++;
    }
    if (!count) continue;
    rows.push({
      athlete: a,
      best: b,
      total,
      pct: (pct / discs.length) * 100,
      count,
    });
  }

  const key = opts.metric === "pct" ? "pct" : "total";
  rows.sort((x, y) => y[key] - x[key] || y.count - x.count);

  const ranked: RankingRow[] = [];
  let prev: RankingRow | null = null;
  rows.forEach((r, i) => {
    const pos =
      prev && Math.abs(prev[key] - r[key]) < 1e-9 && prev.count === r.count
        ? prev.pos
        : i + 1;
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
