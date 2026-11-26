import type {
  ConsentPurpose,
  ConsentRecord,
  FootageAsset,
  LicenseTier,
  Product,
  RecordingRights,
  SeedDb,
  ShowcaseDive,
} from "@/types/domain";

/** Pure check — kept here so client bundles importing rights never pull `fs`. */
function hasPlayableFile(asset: FootageAsset | undefined): boolean {
  if (!asset) return false;
  if (asset.rightsModel === "cmas_link") return false;
  return !!asset.storageKey && asset.durationSec > 0;
}

const TIER_RANK: Record<LicenseTier, number> = {
  sample: 0,
  short: 1,
  watermark: 2,
  social: 3,
  master: 4,
  commercial: 5,
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

function footageForDive(
  db: SeedDb,
  diveId: string | undefined,
): FootageAsset | undefined {
  if (!diveId) return undefined;
  const list = (db.footageAssets ?? []).filter(
    (a) => a.performanceDiveId === diveId,
  );
  return (
    list.find((a) => a.quality === "preview") ??
    list.find((a) => a.quality === "hq") ??
    list[0]
  );
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
  const footage = footageForDive(db, opts.diveId);
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

  if (
    rights?.rightsModel === "cmas_link" ||
    rights?.embedOnly ||
    footage?.rightsModel === "cmas_link"
  ) {
    return {
      allowed: false,
      reason: "cmas_embed_only",
      message:
        rights?.blockReason ??
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

  const hasFile =
    opts.hasVideo === true ||
    hasPlayableFile(footage) ||
    (opts.hasVideo !== false && !!footage && hasPlayableFile(footage));

  if (!hasFile) {
    return {
      allowed: false,
      reason: "no_footage",
      message: "No Diveye FootageAsset linked yet (footage pending).",
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

  if (tier === "short" || tier === "watermark") {
    return {
      allowed: true,
      reason: "ok",
      message:
        tier === "short"
          ? "Short access · watermarked stream (48 h)."
          : "Long watermarked stream access.",
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
        : tier === "master"
          ? "HQ / master · montage after purchase · email when ready."
          : "Diveye-owned · downloadable after licence purchase.",
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
        hasVideo: hasPlayableFile(footageForDive(db, dive.id)),
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
    const footage = footageForDive(db, product.diveId);
    if (!dive && !footage) {
      return {
        allowed: false,
        reason: "no_footage",
        message: "Linked dive / FootageAsset not found.",
        badge: "unavailable",
      };
    }
    const athleteSlug =
      dive?.athleteSlug ?? footage?.athleteSlug ?? "";
    return evaluateSale(db, {
      diveId: product.diveId,
      athleteSlug,
      licenseTier: product.licenseTier ?? "social",
      hasVideo: hasPlayableFile(footage),
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
  const footage = footageForDive(db, dive.id);
  return evaluateSale(db, {
    diveId: dive.id,
    athleteSlug: dive.athleteSlug,
    licenseTier: dive.licenseTier ?? "social",
    hasVideo: hasPlayableFile(footage) || dive.durationSec > 0,
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
