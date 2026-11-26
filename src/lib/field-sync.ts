import type {
  Athlete,
  ConsentRecord,
  DiveAssignment,
  FieldSession,
  Performance,
  SessionUser,
} from "@/types/domain";
import type { FieldBufferOp } from "@/lib/field-buffer";
import {
  appendDiveAssignment,
  appendPerformanceStub,
  loadFieldRuntime,
  upsertFieldSession,
} from "@/lib/field-runtime";
import { getRepository, invalidateSeedCache } from "@/lib/repository";

export type FieldSyncResultItem = {
  opId: string;
  ok: boolean;
  error?: string;
  sessionId?: string;
  assignmentId?: string;
  diveId?: string;
  performanceId?: string;
  consentOk?: boolean;
};

export type FieldSyncResponse = {
  ok: boolean;
  results: FieldSyncResultItem[];
  aliases: Record<string, string>;
};

function resolveSession(
  id: string | undefined,
  aliases: Record<string, string>,
): FieldSession | undefined {
  if (!id) return undefined;
  const resolved = aliases[id] ?? id;
  const repo = getRepository();
  return (
    repo.getFieldSession(resolved) ??
    loadFieldRuntime().fieldSessions.find((s) => s.id === resolved)
  );
}

export function checkAthleteRecordingConsent(
  athlete: Athlete | undefined,
  consents: ConsentRecord[],
): { ok: boolean; reason?: string } {
  if (!athlete) {
    return { ok: false, reason: "Athlete not found" };
  }
  const recording = consents.find((c) => c.purpose === "recording");
  if (!recording || recording.status !== "granted") {
    return { ok: false, reason: "Missing recording consent" };
  }
  if (athlete.minor || athlete.status === "minor") {
    if (!athlete.guardianConsentGranted && !recording.guardianConsent) {
      return { ok: false, reason: "Guardian consent required for minor" };
    }
  }
  return { ok: true };
}

function applyOpenSession(
  op: FieldBufferOp,
  aliases: Record<string, string>,
  user: SessionUser,
): FieldSyncResultItem {
  const deviceId = op.deviceId;
  if (!deviceId) {
    return { opId: op.id, ok: false, error: "deviceId required" };
  }
  const repo = getRepository();
  const device = repo.getDevice(deviceId);
  if (!device) {
    return { opId: op.id, ok: false, error: "Unknown device" };
  }

  const clientSessionId = op.sessionId || op.id;
  const existing = resolveSession(clientSessionId, aliases);
  if (existing) {
    aliases[clientSessionId] = existing.id;
    return {
      opId: op.id,
      ok: true,
      sessionId: existing.id,
      consentOk: true,
    };
  }

  const sessionId = clientSessionId.startsWith("fs-")
    ? clientSessionId
    : `fs-field-${Date.now().toString(36)}`;
  const session: FieldSession = {
    id: sessionId,
    kind: op.kind ?? "training",
    status: "active",
    ownerOrg: op.ownerOrg || device.ownerOrg || "diveye-hq",
    label: op.label || `Field · ${device.label || device.serial}`,
    venue: op.venue,
    startedAt: op.at || new Date().toISOString(),
    deviceIds: [deviceId],
    consentIds: [],
    notes: `Opened by ${user.email} via /field`,
  };
  upsertFieldSession(session);
  aliases[clientSessionId] = sessionId;
  if (clientSessionId !== sessionId) {
    aliases[op.id] = sessionId;
  }
  return { opId: op.id, ok: true, sessionId, consentOk: true };
}

function applyCloseSession(
  op: FieldBufferOp,
  aliases: Record<string, string>,
): FieldSyncResultItem {
  const session = resolveSession(op.sessionId, aliases);
  if (!session) {
    return { opId: op.id, ok: false, error: "Session not found" };
  }
  const closed: FieldSession = {
    ...session,
    status: "completed",
    endedAt: op.at || new Date().toISOString(),
  };
  upsertFieldSession(closed);
  aliases[op.sessionId!] = closed.id;
  return { opId: op.id, ok: true, sessionId: closed.id, consentOk: true };
}

function applyAssign(
  op: FieldBufferOp,
  aliases: Record<string, string>,
): FieldSyncResultItem {
  const session = resolveSession(op.sessionId, aliases);
  if (!session) {
    return { opId: op.id, ok: false, error: "Session not found — open first" };
  }
  if (session.status !== "active") {
    return { opId: op.id, ok: false, error: "Session is not active" };
  }

  const athleteSlug = op.athleteSlug?.trim().toLowerCase();
  if (!athleteSlug) {
    return { opId: op.id, ok: false, error: "athleteSlug required" };
  }

  const deviceId = op.deviceId || session.deviceIds[0];
  if (!deviceId) {
    return { opId: op.id, ok: false, error: "deviceId required" };
  }

  const repo = getRepository();
  const athlete = repo.getAthleteBySlug(athleteSlug);
  const consents = repo.listConsents(athleteSlug);
  const consent = checkAthleteRecordingConsent(athlete, consents);
  if (!consent.ok) {
    return {
      opId: op.id,
      ok: false,
      error: consent.reason,
      consentOk: false,
      sessionId: session.id,
    };
  }

  const diveId =
    op.diveId?.trim() ||
    `dive-field-${Date.now().toString(36)}-${athleteSlug.slice(0, 8)}`;

  const assignmentId = op.id.startsWith("da-")
    ? op.id
    : `da-field-${Date.now().toString(36)}`;

  const runtime = loadFieldRuntime();
  const dup = [...(repo.listDiveAssignments({ fieldSessionId: session.id }) ?? []), ...runtime.diveAssignments]
    .find(
      (a) =>
        a.id === assignmentId ||
        (a.fieldSessionId === session.id &&
          a.athleteSlug === athleteSlug &&
          a.diveId === diveId),
    );
  if (dup) {
    return {
      opId: op.id,
      ok: true,
      sessionId: session.id,
      assignmentId: dup.id,
      diveId: dup.diveId,
      consentOk: true,
    };
  }

  const assignment: DiveAssignment = {
    id: assignmentId,
    fieldSessionId: session.id,
    athleteSlug,
    diveId,
    deviceId,
    assignedAt: op.at || new Date().toISOString(),
    role: op.role ?? "primary",
    notes:
      op.notes ||
      (op.qrRaw ? `QR: ${op.qrRaw}` : undefined) ||
      "Assigned via /field sync",
  };
  appendDiveAssignment(assignment);

  // Link recording consent ids onto session when present.
  const recordingIds = consents
    .filter((c) => c.purpose === "recording" && c.status === "granted")
    .map((c) => c.id);
  if (recordingIds.length) {
    const consentIds = Array.from(
      new Set([...(session.consentIds ?? []), ...recordingIds]),
    );
    upsertFieldSession({ ...session, consentIds });
  }

  let performanceId: string | undefined;
  const stub = op.performanceStub;
  if (stub && athlete) {
    const eventId = stub.eventId || session.eventId || "field-local";
    const eventName =
      stub.eventName ||
      (session.eventId
        ? repo.getEventById(session.eventId)?.name
        : undefined) ||
      session.label;
    const perf: Performance = {
      id: `perf-field-${assignmentId}`,
      athleteId: athlete.id,
      athleteSlug,
      eventId,
      eventName: eventName || "Field session",
      discipline: stub.discipline || "DYN",
      federation: stub.federation || "AIDA",
      date: (op.at || new Date().toISOString()).slice(0, 10),
      ap: typeof stub.ap === "number" ? stub.ap : 0,
      rp: 0,
      card: "W",
      points: 0,
      status: "provisional",
      diveId,
      day: 1,
      ot: "00:00",
      source: "FIELD",
      provenance: "field-app-mvp",
    };
    appendPerformanceStub(perf);
    performanceId = perf.id;
  }

  return {
    opId: op.id,
    ok: true,
    sessionId: session.id,
    assignmentId: assignment.id,
    diveId,
    performanceId,
    consentOk: true,
  };
}

/** Apply buffered field ops in order; persist runtime overlay. */
export function applyFieldSync(
  ops: FieldBufferOp[],
  user: SessionUser,
): FieldSyncResponse {
  const results: FieldSyncResultItem[] = [];
  const aliases: Record<string, string> = {};

  for (const op of ops) {
    let result: FieldSyncResultItem;
    switch (op.type) {
      case "open_session":
        result = applyOpenSession(op, aliases, user);
        break;
      case "close_session":
        result = applyCloseSession(op, aliases);
        break;
      case "assign":
        result = applyAssign(op, aliases);
        break;
      default:
        result = { opId: op.id, ok: false, error: "Unknown op type" };
    }
    results.push(result);
  }

  invalidateSeedCache();
  return {
    ok: results.every((r) => r.ok),
    results,
    aliases,
  };
}
