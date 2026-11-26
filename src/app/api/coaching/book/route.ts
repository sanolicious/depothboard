import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bookSession } from "@/lib/coaching-marketplace";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sign in required to book coaching",
        loginRequired: true,
      },
      { status: 401 },
    );
  }

  let body: {
    coachSlug?: string;
    packageId?: string;
    slotId?: string;
    notes?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const coachSlug = body.coachSlug?.trim();
  const packageId = body.packageId?.trim();
  const slotId = body.slotId?.trim();
  if (!coachSlug || !packageId || !slotId) {
    return NextResponse.json(
      { ok: false, error: "coachSlug, packageId and slotId are required" },
      { status: 400 },
    );
  }

  const result = bookSession({
    user: session,
    coachSlug,
    packageId,
    slotId,
    notes: body.notes,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    booking: result.booking,
    redirect: `/account?booking=${result.booking.id}`,
  });
}
