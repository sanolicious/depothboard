import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

export const runtime = "nodejs";

/** GET /api/sessions — read-only field / capture session list. */
export async function GET(req: Request) {
  const repo = getRepository();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let sessions = repo.listFieldSessions();
  if (status) {
    sessions = sessions.filter((s) => s.status === status);
  }
  return NextResponse.json({
    ok: true,
    count: sessions.length,
    sessions,
  });
}
