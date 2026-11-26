import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  CoachAvailabilitySlot,
  CoachPackage,
  CoachProfile,
  CoachingBooking,
  CoachingMarketplaceSeed,
  SessionUser,
} from "@/types/domain";

/**
 * Diveye platform commission on coaching bookings (S5.3).
 * Orientative MVP constant — change here; surfaced in docs and booking rows.
 */
export const DIVYE_COACHING_COMMISSION_PERCENT = 15;

export const COACHING_DISCLAIMER =
  "Coaching marketplace sessions are training support only — not medical advice, not a safety clearance, and not a substitute for in-water supervision.";

const MARKET_FILE = "coaching-marketplace.json";
const BOOKINGS_FILE = "coaching-bookings.json";

let marketCache: CoachingMarketplaceSeed | null = null;
let bookingsCache: CoachingBooking[] | null = null;

function marketPath() {
  return path.join(process.cwd(), "data", MARKET_FILE);
}

function bookingsPath() {
  return path.join(process.cwd(), "data", BOOKINGS_FILE);
}

function emptyMarket(): CoachingMarketplaceSeed {
  return { profiles: [], packages: [], slots: [] };
}

function readMarket(): CoachingMarketplaceSeed {
  if (marketCache) return marketCache;
  const file = marketPath();
  if (!existsSync(file)) {
    marketCache = emptyMarket();
    return marketCache;
  }
  try {
    const parsed = JSON.parse(
      readFileSync(file, "utf8"),
    ) as CoachingMarketplaceSeed;
    marketCache = {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      packages: Array.isArray(parsed.packages) ? parsed.packages : [],
      slots: Array.isArray(parsed.slots) ? parsed.slots : [],
    };
  } catch {
    marketCache = emptyMarket();
  }
  return marketCache;
}

function persistMarket(market: CoachingMarketplaceSeed): boolean {
  try {
    writeFileSync(
      marketPath(),
      JSON.stringify(market, null, 2) + "\n",
      "utf8",
    );
    marketCache = market;
    return true;
  } catch {
    return false;
  }
}

function readBookings(): CoachingBooking[] {
  if (bookingsCache) return bookingsCache;
  const file = bookingsPath();
  if (!existsSync(file)) {
    bookingsCache = [];
    return bookingsCache;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as CoachingBooking[];
    bookingsCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    bookingsCache = [];
  }
  return bookingsCache;
}

function persistBookings(bookings: CoachingBooking[]): boolean {
  try {
    writeFileSync(
      bookingsPath(),
      JSON.stringify(bookings, null, 2) + "\n",
      "utf8",
    );
    bookingsCache = bookings;
    return true;
  } catch {
    return false;
  }
}

export function invalidateCoachingCache(): void {
  marketCache = null;
  bookingsCache = null;
}

export function listCoachProfiles(activeOnly = true): CoachProfile[] {
  const list = readMarket().profiles;
  return activeOnly ? list.filter((p) => p.active) : list;
}

export function getCoachProfileBySlug(
  slug: string,
): CoachProfile | undefined {
  return readMarket().profiles.find((p) => p.slug === slug);
}

export function getCoachProfileByUserId(
  userId: string,
): CoachProfile | undefined {
  return readMarket().profiles.find((p) => p.userId === userId);
}

export function listPackagesForCoach(coachSlug: string): CoachPackage[] {
  return readMarket().packages.filter((p) => p.coachSlug === coachSlug);
}

export function getPackageById(id: string): CoachPackage | undefined {
  return readMarket().packages.find((p) => p.id === id);
}

export function listSlotsForCoach(
  coachSlug: string,
  opts?: { openOnly?: boolean },
): CoachAvailabilitySlot[] {
  let list = readMarket().slots.filter((s) => s.coachSlug === coachSlug);
  if (opts?.openOnly) {
    list = list.filter((s) => s.status === "open");
  }
  return list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function getSlotById(id: string): CoachAvailabilitySlot | undefined {
  return readMarket().slots.find((s) => s.id === id);
}

export function computeCommission(priceEur: number): {
  commissionPercent: number;
  diveyeFeeEur: number;
  coachPayoutEur: number;
} {
  const commissionPercent = DIVYE_COACHING_COMMISSION_PERCENT;
  const diveyeFeeEur =
    Math.round(((priceEur * commissionPercent) / 100) * 100) / 100;
  const coachPayoutEur = Math.round((priceEur - diveyeFeeEur) * 100) / 100;
  return { commissionPercent, diveyeFeeEur, coachPayoutEur };
}

export function listBookingsForAthlete(userId: string): CoachingBooking[] {
  return readBookings()
    .filter((b) => b.athleteUserId === userId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function listBookingsForCoach(coachUserId: string): CoachingBooking[] {
  return readBookings()
    .filter((b) => b.coachUserId === coachUserId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function upcomingBookings(
  bookings: CoachingBooking[],
  now = new Date(),
): CoachingBooking[] {
  const iso = now.toISOString();
  return bookings.filter(
    (b) =>
      b.status !== "cancelled" &&
      b.endsAt >= iso,
  );
}

export type BookSessionResult =
  | { ok: true; booking: CoachingBooking }
  | { ok: false; error: string; status: number };

/** Simulated pay → Booking JSON (Stripe reuse deferred; shop path remains separate). */
export function bookSession(opts: {
  user: SessionUser;
  coachSlug: string;
  packageId: string;
  slotId: string;
  notes?: string;
}): BookSessionResult {
  const profile = getCoachProfileBySlug(opts.coachSlug);
  if (!profile || !profile.active) {
    return { ok: false, error: "Coach not found", status: 404 };
  }

  const pkg = getPackageById(opts.packageId);
  if (!pkg || pkg.coachSlug !== opts.coachSlug) {
    return { ok: false, error: "Package not found for this coach", status: 400 };
  }

  const market = readMarket();
  const slotIndex = market.slots.findIndex((s) => s.id === opts.slotId);
  if (slotIndex < 0) {
    return { ok: false, error: "Slot not found", status: 404 };
  }
  const slot = market.slots[slotIndex]!;
  if (slot.coachSlug !== opts.coachSlug) {
    return { ok: false, error: "Slot does not belong to this coach", status: 400 };
  }
  if (slot.status !== "open") {
    return { ok: false, error: "Slot is no longer available", status: 409 };
  }

  if (opts.user.id === profile.userId) {
    return {
      ok: false,
      error: "Coaches cannot book their own marketplace slots",
      status: 400,
    };
  }

  const fees = computeCommission(pkg.priceEur);
  const booking: CoachingBooking = {
    id: `CB-${Date.now().toString(36).toUpperCase()}`,
    coachSlug: profile.slug,
    coachUserId: profile.userId,
    athleteUserId: opts.user.id,
    athleteEmail: opts.user.email,
    athleteName: opts.user.name,
    packageId: pkg.id,
    packageTitle: pkg.title,
    slotId: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    priceEur: pkg.priceEur,
    commissionPercent: fees.commissionPercent,
    diveyeFeeEur: fees.diveyeFeeEur,
    coachPayoutEur: fees.coachPayoutEur,
    status: "paid_simulated",
    payment: { provider: "simulated", simulated: true },
    createdAt: new Date().toISOString(),
    notes: opts.notes?.trim() || undefined,
  };

  const nextSlots = market.slots.slice();
  nextSlots[slotIndex] = {
    ...slot,
    status: "booked",
    bookingId: booking.id,
  };
  const nextMarket: CoachingMarketplaceSeed = {
    ...market,
    slots: nextSlots,
  };

  const allBookings = readBookings().slice();
  allBookings.push(booking);

  if (!persistMarket(nextMarket) || !persistBookings(allBookings)) {
    invalidateCoachingCache();
    return { ok: false, error: "Could not persist booking", status: 500 };
  }

  return { ok: true, booking };
}

export function fmtSlotRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const t0 = start.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const t1 = end.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date} · ${t0}–${t1} UTC`;
}
