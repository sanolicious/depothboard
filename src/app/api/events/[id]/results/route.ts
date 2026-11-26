import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/**
 * GET /api/events/[id]/results
 * Polling stub for live / provisional results (client refreshes ~30s).
 * `id` may be event id or slug.
 */
export async function GET(
  req: Request,
  { params }: { params: Params },
) {
  const { id } = await params;
  const repo = getRepository();
  const ev =
    repo.getEventById(id) ??
    repo.getEventBySlug(id);
  if (!ev) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") || "80", 10) || 80),
  );

  let results = repo.listPerformancesForEvent(ev.id, 500);
  if (status && status !== "all") {
    results = results.filter((p) => p.status === status);
  }
  results = results.slice(0, limit);

  const athletes: Record<
    string,
    { slug: string; name: string; country: string; neutral: boolean }
  > = {};
  for (const p of results) {
    if (athletes[p.athleteSlug]) continue;
    const a = repo.getAthleteBySlug(p.athleteSlug);
    if (!a) continue;
    athletes[p.athleteSlug] = {
      slug: a.slug,
      name: a.name,
      country: a.country,
      neutral: a.neutral,
    };
  }

  return NextResponse.json({
    ok: true,
    event: {
      id: ev.id,
      slug: ev.slug,
      shortName: ev.shortName,
      status: ev.status,
      day: ev.day,
      ofDays: ev.ofDays,
      liveUrl: ev.liveUrl ?? null,
    },
    count: results.length,
    refreshedAt: new Date().toISOString(),
    pollIntervalSec: 30,
    results,
    athletes,
  });
}
