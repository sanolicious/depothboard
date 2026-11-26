import { NextResponse } from "next/server";
import {
  authenticateCredentials,
  sealSession,
  sessionCookieOptions,
} from "@/lib/auth";
import { toPublicUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Email and password are required" },
      { status: 400 },
    );
  }

  const user = authenticateCredentials(email, password);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const session = toPublicUser(user);
  const token = sealSession(session);
  const res = NextResponse.json({ ok: true, user: session });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
