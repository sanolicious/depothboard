import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { ClaimRequest, ClaimVerifyMethod } from "@/types/domain";
import { getSession } from "@/lib/auth";
import { invalidateSeedCache } from "@/lib/repository";

export const runtime = "nodejs";

function claimsPath() {
  return path.join(process.cwd(), "data", "claim-requests.json");
}

function readClaims(): ClaimRequest[] {
  const file = claimsPath();
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as ClaimRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistClaims(claims: ClaimRequest[]): boolean {
  try {
    writeFileSync(claimsPath(), JSON.stringify(claims, null, 2) + "\n", "utf8");
    return true;
  } catch {
    try {
      appendFileSync(
        path.join(process.cwd(), "data", "claim-requests.jsonl"),
        JSON.stringify(claims[claims.length - 1]) + "\n",
        "utf8",
      );
      return true;
    } catch {
      return false;
    }
  }
}

export async function GET() {
  const session = await getSession();
  const all = readClaims();
  if (!session) {
    return NextResponse.json({ claims: [] });
  }
  return NextResponse.json({
    claims: all.filter(
      (c) => c.userId === session.id || c.email.toLowerCase() === session.email.toLowerCase(),
    ),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sign in required to submit a claim" },
      { status: 401 },
    );
  }

  let body: {
    athleteName?: string;
    email?: string;
    federationId?: string;
    athleteSlug?: string;
    guardian?: boolean;
    verifyMethod?: ClaimVerifyMethod;
    eventProofIds?: string[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const athleteName = body.athleteName?.trim();
  const email = (body.email?.trim() || session.email).trim();
  if (!athleteName || !email) {
    return NextResponse.json(
      { ok: false, error: "athleteName and email are required" },
      { status: 400 },
    );
  }

  if (session.athleteSlug && body.athleteSlug && session.athleteSlug !== body.athleteSlug) {
    return NextResponse.json(
      {
        ok: false,
        error: "This account already owns another athlete profile",
      },
      { status: 409 },
    );
  }

  const inbox = "claims@depthboard.com";
  const claim: ClaimRequest = {
    id: `CLAIM-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
    athleteName,
    athleteSlug: body.athleteSlug?.trim() || undefined,
    email,
    userId: session.id,
    federationId: body.federationId?.trim() || undefined,
    guardian: !!body.guardian,
    verifyMethod: body.verifyMethod,
    eventProofIds: body.eventProofIds?.filter(Boolean),
    status: "pending",
    createdAt: new Date().toISOString(),
    notes: "Submitted via /claim wizard (auth session)",
  };

  const existing = readClaims();
  existing.push(claim);
  if (!persistClaims(existing)) {
    return NextResponse.json(
      { ok: false, error: "Could not persist claim log" },
      { status: 500 },
    );
  }

  invalidateSeedCache();

  const subject = encodeURIComponent(
    `Profile claim ${claim.id}: ${athleteName}`,
  );
  const mailBody = encodeURIComponent(
    [
      `Claim ID: ${claim.id}`,
      `User ID: ${session.id}`,
      `Athlete: ${athleteName}`,
      claim.athleteSlug ? `Slug: ${claim.athleteSlug}` : null,
      `Email: ${email}`,
      claim.federationId ? `Federation ID: ${claim.federationId}` : null,
      claim.verifyMethod ? `Verify method: ${claim.verifyMethod}` : null,
      claim.eventProofIds?.length
        ? `Event proof: ${claim.eventProofIds.join("; ")}`
        : null,
      `Guardian claim: ${claim.guardian ? "yes" : "no"}`,
      `Submitted: ${claim.createdAt}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return NextResponse.json({
    ok: true,
    claim,
    mailto: `mailto:${inbox}?subject=${subject}&body=${mailBody}`,
  });
}
