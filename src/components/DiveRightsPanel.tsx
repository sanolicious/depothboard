"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AddToCartButton } from "@/components/AddToCartButton";
import { Icon } from "@/components/Icon";
import {
  localConsentGranted,
  readLocalConsents,
  type LocalConsentState,
} from "@/lib/consent-local";
import { WATERMARK_NOTE } from "@/lib/rights";
import type { LicenseTier, RecordingRights } from "@/types/domain";

type SeedFlags = {
  recording: boolean;
  publication: boolean;
  commercial: boolean;
  guardianOk: boolean;
  minor: boolean;
};

function decide(opts: {
  rights?: RecordingRights;
  hasVideo: boolean;
  tier: LicenseTier;
  flags: SeedFlags;
  local: LocalConsentState;
}): { allowed: boolean; message: string; badge: string } {
  const guardian =
    opts.local.guardianConsentGranted ?? opts.flags.guardianOk;
  if (opts.flags.minor && !guardian) {
    return {
      allowed: false,
      message: "Junior athlete — guardian consent required.",
      badge: "Unavailable",
    };
  }
  if (opts.rights?.embedOnly || opts.rights?.rightsModel === "cmas_link") {
    return {
      allowed: false,
      message:
        opts.rights.blockReason ??
        "CMAS embed / link only — no Diveye download or shop sale.",
      badge: "CMAS embed-only",
    };
  }
  if (opts.rights && !opts.rights.saleEnabled) {
    return {
      allowed: false,
      message: opts.rights.blockReason ?? "Sale disabled for this recording.",
      badge: "Unavailable",
    };
  }
  const recording = localConsentGranted(
    opts.local,
    "recording",
    opts.flags.recording,
  );
  const publication = localConsentGranted(
    opts.local,
    "publication",
    opts.flags.publication,
  );
  const commercial = localConsentGranted(
    opts.local,
    "commercial",
    opts.flags.commercial,
  );
  if (!recording || !publication) {
    return {
      allowed: false,
      message: !recording
        ? "Missing consent to record."
        : "Missing consent to publish.",
      badge: "No consent",
    };
  }
  if (opts.tier === "commercial" && !commercial) {
    return {
      allowed: false,
      message: "Commercial licence needs commercial-use consent.",
      badge: "No commercial consent",
    };
  }
  if (!opts.hasVideo && !opts.rights) {
    return {
      allowed: false,
      message: "No Diveye footage linked yet.",
      badge: "No footage",
    };
  }
  return {
    allowed: true,
    message: opts.rights?.downloadable
      ? "AIDA · Diveye-owned · add to cart when eligible."
      : "Preview available.",
    badge: opts.rights?.downloadable ? "AIDA downloadable" : "Preview",
  };
}

export function DiveRightsPanel({
  athleteSlug,
  athleteName,
  diveTitle,
  discipline,
  rpLabel,
  price,
  scene,
  hasVideo,
  eventShortName,
  eventLiveUrl,
  rights,
  seedFlags,
  licenseTier = "social",
  productId,
  productSku,
  diveId,
}: {
  athleteSlug: string;
  athleteName: string;
  diveTitle: string;
  discipline: string;
  rpLabel: string;
  price: number;
  scene: { h: number; x: string; d: number };
  hasVideo: boolean;
  eventShortName: string;
  eventLiveUrl?: string;
  rights?: RecordingRights;
  seedFlags: SeedFlags;
  licenseTier?: LicenseTier;
  productId?: string;
  productSku?: string;
  diveId?: string;
}) {
  const [local, setLocal] = useState<LocalConsentState>({});

  useEffect(() => {
    setLocal(readLocalConsents(athleteSlug));
    const onStorage = () => setLocal(readLocalConsents(athleteSlug));
    window.addEventListener("storage", onStorage);
    window.addEventListener("depthboard:consents", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("depthboard:consents", onStorage);
    };
  }, [athleteSlug]);

  const decision = useMemo(
    () =>
      decide({
        rights,
        hasVideo,
        tier: licenseTier,
        flags: seedFlags,
        local,
      }),
    [rights, hasVideo, licenseTier, seedFlags, local],
  );

  const embedOnly =
    rights?.embedOnly || rights?.rightsModel === "cmas_link";

  return (
    <div className="buybox">
      <div className="row row--between row--wrap" style={{ gap: 8 }}>
        <div>
          <div className="eyebrow" style={{ color: "#9fd9e3" }}>
            Footage rights
          </div>
          <h3 style={{ fontSize: "1.1rem", marginTop: 6 }}>{decision.badge}</h3>
        </div>
        <span className="badge">{rights?.federation ?? "—"}</span>
      </div>

      {embedOnly ? (
        <>
          <p className="small muted" style={{ margin: "12px 0 16px" }}>
            {decision.message}
          </p>
          {(rights?.embedUrl || eventLiveUrl) && (
            <a
              className="btn btn--primary btn--block"
              href={rights?.embedUrl || eventLiveUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="play" /> Open CMAS / event stream
            </a>
          )}
          <p className="caption" style={{ marginTop: 12 }}>
            Product unavailable in shop — CMAS link-only policy.
          </p>
        </>
      ) : !decision.allowed ? (
        <>
          <p className="small muted" style={{ margin: "12px 0 16px" }}>
            {decision.message}
          </p>
          <Link className="btn btn--ghost btn--block" href="/account">
            Manage consents in athlete panel
          </Link>
          <Link
            className="btn btn--ghost btn--block"
            href="/claim"
            style={{ marginTop: 8 }}
          >
            Claim profile
          </Link>
        </>
      ) : hasVideo ? (
        <>
          <div className="row row--between" style={{ marginTop: 8 }}>
            <div className="price">
              €{price}
              <small>dive clip · {licenseTier}</small>
            </div>
            <Icon name="film" />
          </div>
          <ul className="checklist">
            <li>
              <Icon name="check" /> {decision.message}
            </li>
            <li>
              <Icon name="check" /> {WATERMARK_NOTE}
            </li>
          </ul>
          <AddToCartButton
            productId={productId}
            sku={productSku}
            diveId={diveId}
            licenseTier={licenseTier}
            title={`Dive clip: ${athleteName
              .split(" ")
              .map((p, i, a) => (i === a.length - 1 ? p : p[0] + "."))
              .join(" ")}, ${discipline} ${rpLabel}`}
            description={`${licenseTier} licence · ${eventShortName}`}
            price={price}
            scene={scene}
            label={`Buy clip · €${price}`}
          />
          <div className="row row--between row--wrap">
            <AddToCartButton
              productId={
                diveId ? `prod-ft-${diveId}-sample` : undefined
              }
              sku={diveId ? `sample-${diveId}` : undefined}
              diveId={diveId}
              licenseTier="sample"
              title={`Sample: ${athleteName} · ${discipline}`}
              description="Free watermarked sample"
              price={0}
              scene={{ h: 196, x: "50%", d: 0.4 }}
              label="Add free sample"
              ghost
            />
            <Link className="link-arrow small" href="/shop">
              Compare funnel <Icon name="arrow" />
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="small muted" style={{ margin: "12px 0 16px" }}>
            Rights and consents look clear, but Diveye OT footage is not linked
            for “{diveTitle}” yet.
          </p>
          <Link className="btn btn--primary btn--block" href="/shop">
            See licence plans
          </Link>
        </>
      )}
    </div>
  );
}

export function RightsBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  const style =
    tone === "ok"
      ? { background: "rgba(46, 160, 120, 0.2)", color: "#9fe7c8" }
      : tone === "warn"
        ? { background: "rgba(200, 120, 40, 0.22)", color: "#f0c090" }
        : undefined;
  return (
    <span className="badge" style={style}>
      {label}
    </span>
  );
}
