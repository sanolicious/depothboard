import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  DiveAssignment,
  FieldSession,
  Performance,
} from "@/types/domain";

export type FieldRuntimeStore = {
  asOf: string;
  fieldSessions: FieldSession[];
  diveAssignments: DiveAssignment[];
  /** Optional provisional performance stubs created on assign sync. */
  performances: Performance[];
};

const EMPTY: FieldRuntimeStore = {
  asOf: "",
  fieldSessions: [],
  diveAssignments: [],
  performances: [],
};

let cached: FieldRuntimeStore | null = null;

function runtimePath() {
  return path.join(process.cwd(), "data", "field-runtime.json");
}

export function loadFieldRuntime(): FieldRuntimeStore {
  if (cached) return cached;
  const file = runtimePath();
  if (!existsSync(file)) {
    cached = { ...EMPTY };
    return cached;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as FieldRuntimeStore;
    cached = {
      asOf: parsed.asOf ?? "",
      fieldSessions: Array.isArray(parsed.fieldSessions)
        ? parsed.fieldSessions
        : [],
      diveAssignments: Array.isArray(parsed.diveAssignments)
        ? parsed.diveAssignments
        : [],
      performances: Array.isArray(parsed.performances)
        ? parsed.performances
        : [],
    };
  } catch {
    cached = { ...EMPTY };
  }
  return cached;
}

export function invalidateFieldRuntime(): void {
  cached = null;
}

export function persistFieldRuntime(store: FieldRuntimeStore): boolean {
  try {
    const next: FieldRuntimeStore = {
      asOf: store.asOf || new Date().toISOString().slice(0, 10),
      fieldSessions: store.fieldSessions,
      diveAssignments: store.diveAssignments,
      performances: store.performances,
    };
    writeFileSync(
      runtimePath(),
      JSON.stringify(next, null, 2) + "\n",
      "utf8",
    );
    cached = next;
    return true;
  } catch {
    return false;
  }
}

export function upsertFieldSession(session: FieldSession): FieldSession {
  const store = loadFieldRuntime();
  const idx = store.fieldSessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    store.fieldSessions[idx] = { ...store.fieldSessions[idx], ...session };
  } else {
    store.fieldSessions.push(session);
  }
  persistFieldRuntime(store);
  return idx >= 0 ? store.fieldSessions[idx]! : session;
}

export function appendDiveAssignment(
  assignment: DiveAssignment,
): DiveAssignment {
  const store = loadFieldRuntime();
  const existing = store.diveAssignments.find((a) => a.id === assignment.id);
  if (existing) return existing;
  store.diveAssignments.push(assignment);
  persistFieldRuntime(store);
  return assignment;
}

export function appendPerformanceStub(perf: Performance): Performance {
  const store = loadFieldRuntime();
  const existing = store.performances.find(
    (p) => p.id === perf.id || p.diveId === perf.diveId,
  );
  if (existing) return existing;
  store.performances.push(perf);
  persistFieldRuntime(store);
  return perf;
}
