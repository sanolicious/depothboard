/**
 * Client-side offline buffer for the field app.
 * Ops live in localStorage until POST /api/field/sync succeeds.
 */

export type FieldBufferOpType = "open_session" | "close_session" | "assign";

export type FieldPerformanceStubInput = {
  discipline?: string;
  ap?: number;
  federation?: "AIDA" | "CMAS";
  eventId?: string;
  eventName?: string;
};

export type FieldBufferOp = {
  /** Client-generated idempotency key. */
  id: string;
  type: FieldBufferOpType;
  at: string;
  /** Local / server session id (open returns this; assign/close use it). */
  sessionId?: string;
  deviceId?: string;
  kind?: "competition" | "training" | "demo";
  label?: string;
  venue?: string;
  ownerOrg?: string;
  athleteSlug?: string;
  diveId?: string;
  /** Raw QR / badge scan text (stub). */
  qrRaw?: string;
  role?: "primary" | "backup" | "safety";
  notes?: string;
  performanceStub?: FieldPerformanceStubInput;
};

export const FIELD_BUFFER_KEY = "depthboard:field:buffer";
export const FIELD_LOCAL_SESSION_KEY = "depthboard:field:activeSession";

export type FieldLocalSession = {
  id: string;
  deviceId: string;
  label: string;
  kind: "competition" | "training" | "demo";
  venue?: string;
  startedAt: string;
  status: "active" | "completed";
};

export function readFieldBuffer(): FieldBufferOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FIELD_BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FieldBufferOp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeFieldBuffer(ops: FieldBufferOp[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FIELD_BUFFER_KEY, JSON.stringify(ops));
  window.dispatchEvent(new Event("depthboard:field-buffer"));
}

export function enqueueFieldOp(op: FieldBufferOp): FieldBufferOp[] {
  const next = [...readFieldBuffer(), op];
  writeFieldBuffer(next);
  return next;
}

export function clearSyncedOps(syncedIds: string[]): FieldBufferOp[] {
  const drop = new Set(syncedIds);
  const next = readFieldBuffer().filter((o) => !drop.has(o.id));
  writeFieldBuffer(next);
  return next;
}

export function readLocalSession(): FieldLocalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FIELD_LOCAL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FieldLocalSession;
  } catch {
    return null;
  }
}

export function writeLocalSession(session: FieldLocalSession | null): void {
  if (typeof window === "undefined") return;
  if (!session) {
    localStorage.removeItem(FIELD_LOCAL_SESSION_KEY);
  } else {
    localStorage.setItem(FIELD_LOCAL_SESSION_KEY, JSON.stringify(session));
  }
  window.dispatchEvent(new Event("depthboard:field-session"));
}

/** Parse QR stub text → athlete slug when possible. */
export function parseAthleteQr(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const prefixed = t.match(
    /^(?:depthboard:athlete:|athlete:|slug:)([a-z0-9-]+)$/i,
  );
  if (prefixed?.[1]) return prefixed[1].toLowerCase();
  if (/^[a-z0-9-]+$/i.test(t)) return t.toLowerCase();
  return null;
}

export function newClientId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
