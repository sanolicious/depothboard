import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/sessions/:id — session detail + assignments + telemetry hooks. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const repo = getRepository();
  const session = repo.getFieldSession(id);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Session not found" },
      { status: 404 },
    );
  }

  const devices = session.deviceIds
    .map((did) => repo.getDevice(did))
    .filter(Boolean);
  const assignments = repo.listDiveAssignments({ fieldSessionId: id });
  const telemetry = repo.listTelemetrySamples({ fieldSessionId: id });
  const consents = (repo.getDb().consents ?? []).filter(
    (c) =>
      c.fieldSessionId === id ||
      (session.consentIds ?? []).includes(c.id),
  );

  return NextResponse.json({
    ok: true,
    session,
    devices,
    assignments,
    telemetry,
    consents,
  });
}
