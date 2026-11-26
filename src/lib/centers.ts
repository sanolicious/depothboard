import { existsSync, readFileSync } from "fs";
import path from "path";
import type {
  CenterCourseType,
  CentersCatalogSeed,
  DiveCenter,
} from "@/types/domain";

const CENTERS_FILE = "centers.json";

export const CENTER_COURSE_TYPE_LABELS: Record<CenterCourseType, string> = {
  aida: "AIDA",
  cmas: "CMAS",
  fun: "Fun dive",
  competition: "Competition",
  safety: "Safety / rescue",
  instructor: "Instructor",
};

export const ALL_CENTER_COURSE_TYPES = Object.keys(
  CENTER_COURSE_TYPE_LABELS,
) as CenterCourseType[];

let cache: CentersCatalogSeed | null = null;

function centersPath() {
  return path.join(process.cwd(), "data", CENTERS_FILE);
}

function emptySeed(): CentersCatalogSeed {
  return { centers: [] };
}

function readSeed(): CentersCatalogSeed {
  if (cache) return cache;
  const file = centersPath();
  if (!existsSync(file)) {
    cache = emptySeed();
    return cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as CentersCatalogSeed;
    cache = {
      centers: Array.isArray(parsed.centers) ? parsed.centers : [],
    };
  } catch {
    cache = emptySeed();
  }
  return cache;
}

export function listDiveCenters(opts?: {
  country?: string;
  diveyeConnected?: boolean;
  courseType?: CenterCourseType | "all";
  activeOnly?: boolean;
}): DiveCenter[] {
  const activeOnly = opts?.activeOnly !== false;
  let rows = readSeed().centers;
  if (activeOnly) rows = rows.filter((c) => c.active);

  const country = opts?.country?.trim().toUpperCase();
  if (country && country !== "ALL") {
    rows = rows.filter((c) => c.country.toUpperCase() === country);
  }

  if (opts?.diveyeConnected === true) {
    rows = rows.filter((c) => c.diveyeConnected);
  }

  const course = opts?.courseType;
  if (course && course !== "all") {
    rows = rows.filter((c) => c.courseTypes.includes(course));
  }

  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export function getDiveCenterBySlug(slug: string): DiveCenter | undefined {
  return readSeed().centers.find((c) => c.slug === slug && c.active);
}

export function listCenterCountries(): string[] {
  const set = new Set(
    listDiveCenters({ activeOnly: true }).map((c) => c.country.toUpperCase()),
  );
  return [...set].sort();
}

export function fmtPriceRange(from: number, to: number): string {
  if (from === to) return `€${from}`;
  return `€${from}–€${to}`;
}

/** Rough equirectangular projection into the schematic map panel. */
export function centerPinStyle(lat: number, lng: number) {
  const left = ((lng + 180) / 360) * 100;
  const top = ((90 - lat) / 180) * 100;
  return {
    left: `${Math.min(92, Math.max(8, left))}%`,
    top: `${Math.min(88, Math.max(12, top))}%`,
  };
}

export function isCenterCourseType(v: string): v is CenterCourseType {
  return (ALL_CENTER_COURSE_TYPES as string[]).includes(v);
}
