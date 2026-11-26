import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { DemoUser, SessionUser } from "@/types/domain";
import { findUserByEmail, getUserById, toPublicUser } from "@/lib/users";

export const SESSION_COOKIE = "depthboard_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

function secret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "depthboard-demo-auth-secret-change-me"
  );
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function sign(payloadB64: string): string {
  return b64url(createHmac("sha256", secret()).update(payloadB64).digest());
}

export function sealSession(user: SessionUser): string {
  const payload = b64url(
    JSON.stringify({
      ...user,
      exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
    }),
  );
  return `${payload}.${sign(payload)}`;
}

export function unsealSession(token: string | undefined | null): SessionUser | null {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const raw = JSON.parse(fromB64url(payloadB64).toString("utf8")) as SessionUser & {
      exp?: number;
    };
    if (!raw?.id || !raw?.email) return null;
    if (raw.exp && raw.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: raw.id,
      email: raw.email,
      name: raw.name,
      role: raw.role,
      athleteSlug: raw.athleteSlug ?? null,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = unsealSession(token);
  if (!session) return null;
  // Refresh athleteSlug from seed (approved claims may update users.json later)
  const fresh = getUserById(session.id);
  if (!fresh) return session;
  return toPublicUser(fresh);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function authenticateCredentials(
  email: string,
  password: string,
): DemoUser | null {
  const user = findUserByEmail(email);
  if (!user) return null;
  if (user.password !== password) return null;
  return user;
}

export function ownsAthlete(
  session: SessionUser | null | undefined,
  athleteSlug: string | null | undefined,
): boolean {
  if (!session || !athleteSlug) return false;
  return session.athleteSlug === athleteSlug;
}

/** Field app (/field) — operator or admin demo roles. */
export function canAccessField(
  session: SessionUser | null | undefined,
): boolean {
  if (!session) return false;
  return session.role === "operator" || session.role === "admin";
}

/** Federation judges hub (/federation) — judge or admin (federation admin). */
export function canAccessFederation(
  session: SessionUser | null | undefined,
): boolean {
  if (!session) return false;
  return session.role === "judge" || session.role === "admin";
}

/** AI coach account area — coach role (or admin browsing). */
export function isCoachRole(
  session: SessionUser | null | undefined,
): boolean {
  if (!session) return false;
  return session.role === "coach" || session.role === "admin";
}
