import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repository";

export const runtime = "nodejs";

/** GET /api/devices — read-only fleet list (admin / field-app stub). */
export async function GET() {
  const repo = getRepository();
  const devices = repo.listDevices();
  return NextResponse.json({
    ok: true,
    count: devices.length,
    devices,
  });
}
