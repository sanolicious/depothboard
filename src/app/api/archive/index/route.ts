import { NextResponse } from "next/server";
import {
  loadArchiveIndex,
  rebuildArchiveIndex,
} from "@/lib/archive-index";

export const runtime = "nodejs";

/** Read current archive index metadata + moment count. */
export async function GET() {
  const index = loadArchiveIndex();
  return NextResponse.json({
    ok: true,
    asOf: index.asOf,
    engine: index.engine,
    momentCount: index.momentCount,
    notes: index.notes,
  });
}

/**
 * Rebuild searchable moments from FootageAsset markers + dive metadata.
 * Body optional: `{ "enrich": true }` — LLM polish only when OPENAI_API_KEY is set.
 */
export async function POST(req: Request) {
  let enrich = true;
  try {
    const body = (await req.json()) as { enrich?: boolean };
    if (typeof body.enrich === "boolean") enrich = body.enrich;
  } catch {
    // empty body is fine
  }

  const result = await rebuildArchiveIndex({ enrich });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    asOf: result.index.asOf,
    engine: result.index.engine,
    momentCount: result.index.momentCount,
    notes: result.index.notes,
  });
}
