import { NextResponse } from "next/server";
import { canAccessField, getSession } from "@/lib/auth";
import type { FieldBufferOp } from "@/lib/field-buffer";
import { applyFieldSync } from "@/lib/field-sync";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sign in required" },
      { status: 401 },
    );
  }
  if (!canAccessField(session)) {
    return NextResponse.json(
      { ok: false, error: "Operator or admin role required" },
      { status: 403 },
    );
  }

  let body: { ops?: FieldBufferOp[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length) {
    return NextResponse.json(
      { ok: false, error: "ops[] required" },
      { status: 400 },
    );
  }
  if (ops.length > 200) {
    return NextResponse.json(
      { ok: false, error: "Too many ops (max 200)" },
      { status: 400 },
    );
  }

  const result = applyFieldSync(ops, session);
  return NextResponse.json({
    ok: result.ok,
    results: result.results,
    aliases: result.aliases,
  });
}
