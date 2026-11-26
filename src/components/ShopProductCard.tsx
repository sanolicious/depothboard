"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import {
  localConsentGranted,
  readLocalConsents,
  type LocalConsentState,
} from "@/lib/consent-local";
import type { LicenseTier, Product } from "@/types/domain";

type SeedFlags = {
  athleteSlug?: string;
  recording: boolean;
  publication: boolean;
  commercial: boolean;
  minor: boolean;
  guardianOk: boolean;
  embedOnly: boolean;
  rightsSaleEnabled: boolean;
  blockReason?: string;
  maxTier?: LicenseTier;
};

const TIER_RANK: Record<LicenseTier, number> = {
  sample: 0,
  short: 1,
  watermark: 2,
  social: 3,
  master: 4,
  commercial: 5,
};

function productAllowed(
  product: Product,
  flags: SeedFlags,
  local: LocalConsentState,
): { ok: boolean; reason: string } {
  if (flags.embedOnly) {
    return {
      ok: false,
      reason: flags.blockReason ?? "CMAS embed-only — not for sale",
    };
  }
  if (!flags.rightsSaleEnabled && product.diveId) {
    return {
      ok: false,
      reason: flags.blockReason ?? "Recording not cleared for sale",
    };
  }
  if (flags.athleteSlug) {
    if (flags.minor) {
      const g = local.guardianConsentGranted ?? flags.guardianOk;
      if (!g) return { ok: false, reason: "Guardian consent required" };
    }
    const recording = localConsentGranted(
      local,
      "recording",
      flags.recording,
    );
    const publication = localConsentGranted(
      local,
      "publication",
      flags.publication,
    );
    const commercial = localConsentGranted(
      local,
      "commercial",
      flags.commercial,
    );
    if (!recording || !publication) {
      return { ok: false, reason: "Athlete consent missing" };
    }
    const tier = product.licenseTier ?? "social";
    if (tier === "commercial" && !commercial) {
      return { ok: false, reason: "Commercial consent missing" };
    }
    if (flags.maxTier && TIER_RANK[tier] > TIER_RANK[flags.maxTier]) {
      return { ok: false, reason: `Max licence is ${flags.maxTier}` };
    }
  }
  if (product.saleEnabled === false) {
    return { ok: false, reason: "Marked unavailable" };
  }
  return { ok: true, reason: "Available" };
}

export function ShopProductCard({
  product,
  flags,
}: {
  product: Product;
  flags: SeedFlags;
}) {
  const [local, setLocal] = useState<LocalConsentState>({});

  useEffect(() => {
    if (!flags.athleteSlug) return;
    const slug = flags.athleteSlug;
    const refresh = () => setLocal(readLocalConsents(slug));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("depthboard:consents", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("depthboard:consents", refresh);
    };
  }, [flags.athleteSlug]);

  const decision = useMemo(
    () => productAllowed(product, flags, local),
    [product, flags, local],
  );

  return (
    <div
      className="card"
      id={product.slug === "media-pack" ? "media-pack" : undefined}
      style={{
        padding: 20,
        opacity: decision.ok ? 1 : 0.72,
      }}
    >
      <div className="row row--between">
        <div className="eyebrow">{product.kind}</div>
        <span className={`badge ${decision.ok ? "badge--accent" : ""}`}>
          {decision.ok ? product.licenseTier ?? "licence" : "Unavailable"}
        </span>
      </div>
      <h2 style={{ marginTop: 8, fontSize: "1.35rem" }}>{product.name}</h2>
      <div className="price" style={{ margin: "12px 0" }}>
        {product.price > 0
          ? `€${product.price}`
          : product.licenseTier === "sample"
            ? "Free"
            : "on request"}
      </div>
      <p className="muted small">{product.description}</p>
      <p className="caption" style={{ marginTop: 10 }}>
        {decision.ok ? product.delivery : decision.reason}
      </p>
      <div style={{ marginTop: 16 }}>
        {decision.ok ? (
          product.kind === "media" || product.licenseTier === "commercial" ? (
            <Link className="btn btn--ghost btn--sm" href="#media-pack">
              {product.kind === "media"
                ? "Request media pack quote"
                : "Commercial quote form"}
            </Link>
          ) : (
            <AddToCartButton
              productId={product.id}
              sku={product.slug}
              title={product.name}
              description={product.description}
              price={product.price}
              licenseTier={product.licenseTier}
              diveId={product.diveId}
              scene={{ h: 200, x: "50%", d: 0.45 }}
              label={
                product.price > 0
                  ? `Add · €${product.price}`
                  : "Add free sample"
              }
            />
          )
        ) : (
          <span className="btn btn--ghost btn--sm" aria-disabled>
            Not for sale
          </span>
        )}
      </div>
      {product.diveId && (
        <Link
          className="link-arrow small"
          href={`/dives/${product.diveId}`}
          style={{ marginTop: 12, display: "inline-flex" }}
        >
          Open dive page
        </Link>
      )}
    </div>
  );
}
