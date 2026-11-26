import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { ClaimRequest } from "@/types/domain";
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

export async function GET() {
  return NextResponse.json({ claims: readClaims() });
}

export async function POST(req: Request) {
  let body: {
    athleteName?: string;
    email?: string;
    federationId?: string;
    athleteSlug?: string;
    guardian?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const athleteName = body.athleteName?.trim();
  const email = body.email?.trim();
  if (!athleteName || !email) {
    return NextResponse.json(
      { ok: false, error: "athleteName and email are required" },
      { status: 400 },
    );
  }

  const inbox = "claims@depthboard.com";
  const claim: ClaimRequest = {
    id: `claim-${Date.now().toString(36)}`,
    athleteName,
    athleteSlug: body.athleteSlug?.trim() || undefined,
    email,
    federationId: body.federationId?.trim() || undefined,
    guardian: !!body.guardian,
    status: "pending",
    createdAt: new Date().toISOString(),
    notes: "Submitted via /claim form",
  };

  const existing = readClaims();
  existing.push(claim);
  try {
    writeFileSync(claimsPath(), JSON.stringify(existing, null, 2) + "\n", "utf8");
  } catch {
    // Fallback append-only line log if rewrite fails
    try {
      appendFileSync(
        path.join(process.cwd(), "data", "claim-requests.jsonl"),
        JSON.stringify(claim) + "\n",
        "utf8",
      );
    } catch {
      return NextResponse.json(
        { ok: false, error: "Could not persist claim log" },
        { status: 500 },
      );
    }
  }

  invalidateSeedCache();

  const subject = encodeURIComponent(`Profile claim: ${athleteName}`);
  const mailBody = encodeURIComponent(
    [
      `Claim ID: ${claim.id}`,
      `Athlete: ${athleteName}`,
      `Email: ${email}`,
      claim.federationId ? `Federation ID: ${claim.federationId}` : null,
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
