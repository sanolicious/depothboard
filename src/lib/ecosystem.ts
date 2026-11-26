import "server-only";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type {
  Device,
  DiveAssignment,
  FieldSession,
  TelemetrySample,
} from "@/types/domain";

export type EcosystemCatalog = {
  asOf: string;
  notes?: string;
  devices: Device[];
  fieldSessions: FieldSession[];
  diveAssignments: DiveAssignment[];
  telemetrySamples: TelemetrySample[];
};

const EMPTY: EcosystemCatalog = {
  asOf: "",
  devices: [],
  fieldSessions: [],
  diveAssignments: [],
  telemetrySamples: [],
};

let cache: EcosystemCatalog | null = null;

export function loadEcosystemCatalog(): EcosystemCatalog {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "ecosystem.json");
  if (!existsSync(file)) {
    cache = EMPTY;
    return cache;
  }
  const raw = JSON.parse(readFileSync(file, "utf8")) as EcosystemCatalog;
  cache = {
    asOf: raw.asOf ?? "",
    notes: raw.notes,
    devices: raw.devices ?? [],
    fieldSessions: raw.fieldSessions ?? [],
    diveAssignments: raw.diveAssignments ?? [],
    telemetrySamples: raw.telemetrySamples ?? [],
  };
  return cache;
}

/** Drop catalog cache (tests / hot reload). */
export function invalidateEcosystemCatalog(): void {
  cache = null;
}

export function listDevices(): Device[] {
  return loadEcosystemCatalog().devices;
}

export function getDevice(id: string): Device | undefined {
  return listDevices().find((d) => d.id === id);
}

export function listFieldSessions(): FieldSession[] {
  return loadEcosystemCatalog().fieldSessions;
}

export function getFieldSession(id: string): FieldSession | undefined {
  return listFieldSessions().find((s) => s.id === id);
}

export function listDiveAssignments(opts?: {
  fieldSessionId?: string;
  athleteSlug?: string;
  diveId?: string;
  deviceId?: string;
}): DiveAssignment[] {
  let list = loadEcosystemCatalog().diveAssignments;
  if (opts?.fieldSessionId) {
    list = list.filter((a) => a.fieldSessionId === opts.fieldSessionId);
  }
  if (opts?.athleteSlug) {
    list = list.filter((a) => a.athleteSlug === opts.athleteSlug);
  }
  if (opts?.diveId) {
    list = list.filter((a) => a.diveId === opts.diveId);
  }
  if (opts?.deviceId) {
    list = list.filter((a) => a.deviceId === opts.deviceId);
  }
  return list;
}

export function listTelemetrySamples(opts?: {
  fieldSessionId?: string;
  diveId?: string;
  deviceId?: string;
}): TelemetrySample[] {
  let list = loadEcosystemCatalog().telemetrySamples;
  if (opts?.fieldSessionId) {
    list = list.filter((t) => t.fieldSessionId === opts.fieldSessionId);
  }
  if (opts?.diveId) {
    list = list.filter((t) => t.diveId === opts.diveId);
  }
  if (opts?.deviceId) {
    list = list.filter((t) => t.deviceId === opts.deviceId);
  }
  return list;
}
