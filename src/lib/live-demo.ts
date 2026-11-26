import "server-only";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type { Event, LiveResultRow, Performance } from "@/types/domain";

export type LiveDemoCatalog = {
  asOf: string;
  notes?: string;
  events: Event[];
  performances: Performance[];
  liveResults: LiveResultRow[];
};

const EMPTY: LiveDemoCatalog = {
  asOf: "",
  events: [],
  performances: [],
  liveResults: [],
};

let cache: LiveDemoCatalog | null = null;

export function loadLiveDemoCatalog(): LiveDemoCatalog {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "live-demo.json");
  if (!existsSync(file)) {
    cache = EMPTY;
    return cache;
  }
  const raw = JSON.parse(readFileSync(file, "utf8")) as LiveDemoCatalog;
  cache = {
    asOf: raw.asOf ?? "",
    notes: raw.notes,
    events: raw.events ?? [],
    performances: raw.performances ?? [],
    liveResults: raw.liveResults ?? [],
  };
  return cache;
}

/** Drop catalog cache (tests / hot reload). */
export function invalidateLiveDemoCatalog(): void {
  cache = null;
}
