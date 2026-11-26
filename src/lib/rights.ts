import type {
  ConsentPurpose,
  ConsentRecord,
  LicenseTier,
  Product,
  RecordingRights,
  SeedDb,
  ShowcaseDive,
} from "@/types/domain";

const TIER_RANK: Record<LicenseTier, number> = {
  sample: 0,
  social: 1,
  master: 2,
  commercial: 3,
};

export type SaleBlockReason =
  | "ok"
  | "no_footage"
  | "cmas_embed_only"
  | "missing_consent"
  | "tier_not_allowed"
  | "minor_no_guardian"
  | "rights_blocked";

export type SaleDecision = {
  allowed: boolean;
  reason: SaleBlockReason;
  message: string;
  rights?: RecordingRights;
  badge: "downloadable" | "embed_only" | "unavailable" | "preview";
};

function activeConsents(
  db: SeedDb,
  athleteSlug: string,
): ConsentRecord[] {
  return (db.consents ?? []).filter(
    (c) => c.athleteSlug === athleteSlug && c.status === "granted",
  );
}

export function hasConsent(
  db: SeedDb,
  athleteSlug: string,
  purpose: ConsentPurpose,
): boolean {
  return activeConsents(db, athleteSlug).some((c) => c.purpose === purpose);
}

export function getRecordingRights(
  db: SeedDb,
  diveId: string,
): RecordingRights | undefined {
  return (db.recordingRights ?? []).find((r) => r.diveId === diveId);
}

export function tierAllowed(
  max: LicenseTier,
  requested: LicenseTier,
): boolean {
  return TIER_RANK[requested] <= TIER_RANK[max];
}

/** Evaluate whether a dive clip / licence tier can be sold or downloaded. */
export function evaluateSale(
  db: SeedDb,
  opts: {
    diveId?: string;
    athleteSlug: string;
    licenseTier?: LicenseTier;
    hasVideo?: boolean;
  },
): SaleDecision {
  const athlete = db.athletes.find((a) => a.slug === opts.athleteSlug);
  const rights = opts.diveId
    ? getRecordingRights(db, opts.diveId)
    : undefined;
  const tier = opts.licenseTier ?? "social";

  if (athlete?.minor && !athlete.guardianConsentGranted) {
    return {
      allowed: false,
      reason: "minor_no_guardian",
      message:
        "Junior athlete — guardian consent required before any recording use.",
      rights,
      badge: "unavailable",
    };
  }

  if (rights?.rightsModel === "cmas_link" || rights?.embedOnly) {
    return {
      allowed: false,
      reason: "cmas_embed_only",
      message:
        rights.blockReason ??
        "CMAS footage is embed / link only — downloads and shop sales are disabled.",
      rights,
      badge: "embed_only",
    };
  }

  if (rights && !rights.saleEnabled) {
    return {
      allowed: false,
      reason: "rights_blocked",
      message: rights.blockReason ?? "Sale disabled for this recording.",
      rights,
      badge: "unavailable",
    };
  }

  if (!hasConsent(db, opts.athleteSlug, "recording")) {
    return {
      allowed: false,
      reason: "missing_consent",
      message: "Missing athlete consent to record.",
      rights,
      badge: "unavailable",
    };
  }

  if (!hasConsent(db, opts.athleteSlug, "publication")) {
    return {
      allowed: false,
      reason: "missing_consent",
      message: "Missing athlete consent to publish footage.",
      rights,
      badge: "unavailable",
    };
  }

  if (
    tier === "commercial" &&
    !hasConsent(db, opts.athleteSlug, "commercial")
  ) {
    return {
      allowed: false,
      reason: "missing_consent",
      message: "Commercial licence needs commercial-use consent.",
      rights,
      badge: "unavailable",
    };
  }

  if (rights && !tierAllowed(rights.maxLicenseTier, tier)) {
    return {
      allowed: false,
      reason: "tier_not_allowed",
      message: `This recording allows up to “${rights.maxLicenseTier}” licence.`,
      rights,
      badge: "unavailable",
    };
  }

  if (opts.hasVideo === false && !rights) {
    return {
      allowed: false,
      reason: "no_footage",
      message: "No Diveye footage linked yet.",
      rights,
      badge: "unavailable",
    };
  }

  if (tier === "sample") {
    return {
      allowed: true,
      reason: "ok",
      message: "Watermarked sample preview.",
      rights,
      badge: "preview",
    };
  }

  return {
    allowed: true,
    reason: "ok",
    message:
      rights?.downloadable === false
        ? "Preview only."
        : "Diveye-owned · downloadable after licence purchase (checkout stub).",
    rights,
    badge: rights?.downloadable ? "downloadable" : "preview",
  };
}

export function evaluateProduct(db: SeedDb, product: Product): SaleDecision {
  if (product.saleEnabled === false) {
    const rights = product.diveId
      ? getRecordingRights(db, product.diveId)
      : undefined;
    const dive = product.diveId
      ? db.showcaseDives.find((d) => d.id === product.diveId)
      : undefined;
    if (dive) {
      return evaluateSale(db, {
        diveId: dive.id,
        athleteSlug: dive.athleteSlug,
        licenseTier: product.licenseTier ?? "social",
        hasVideo: true,
      });
    }
    return {
      allowed: false,
      reason: "rights_blocked",
      message: "Product marked unavailable.",
      rights,
      badge: "unavailable",
    };
  }

  if (product.diveId) {
    const dive = db.showcaseDives.find((d) => d.id === product.diveId);
    if (!dive) {
      return {
        allowed: false,
        reason: "no_footage",
        message: "Linked dive not found.",
        badge: "unavailable",
      };
    }
    return evaluateSale(db, {
      diveId: dive.id,
      athleteSlug: dive.athleteSlug,
      licenseTier: product.licenseTier ?? "social",
      hasVideo: true,
    });
  }

  // Media packs etc. — require Diveye-owned context; still need no CMAS.
  return {
    allowed: true,
    reason: "ok",
    message: "Available for quote when rights + consents clear.",
    badge: "downloadable",
  };
}

export function evaluateShowcaseDive(
  db: SeedDb,
  dive: ShowcaseDive,
): SaleDecision {
  return evaluateSale(db, {
    diveId: dive.id,
    athleteSlug: dive.athleteSlug,
    licenseTier: dive.licenseTier ?? "social",
    hasVideo: dive.durationSec > 0 || dive.cameras.length > 0,
  });
}

export const CONSENT_PURPOSE_COPY: Record<
  ConsentPurpose,
  { title: string; blurb: string }
> = {
  recording: {
    title: "Recording",
    blurb: "Diveye may capture your competition dives with OT cameras.",
  },
  publication: {
    title: "Publication",
    blurb: "Allow public archive, sample previews and athlete profile clips.",
  },
  commercial: {
    title: "Commercial use",
    blurb: "Sell or license your footage for ads, sponsors and broadcast.",
  },
  coach: {
    title: "Coach access",
    blurb: "Share tagged footage with a linked coach (future).",
  },
};

export const WATERMARK_NOTE =
  "Sample previews carry a Depthboard watermark. Full files unlock only after a cleared licence purchase on Diveye-owned (AIDA) recordings with athlete consent.";
