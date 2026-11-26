import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { analyzeDiveForSession } from "@/lib/coach";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sign in required" },
      { status: 401 },
    );
  }

  let body: { diveId?: string };
  try {
    body = (await req.json()) as { diveId?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const diveId = body.diveId?.trim();
  if (!diveId) {
    return NextResponse.json(
      { ok: false, error: "diveId is required" },
      { status: 400 },
    );
  }

  const result = await analyzeDiveForSession(diveId, session);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, report: result.report });
}
