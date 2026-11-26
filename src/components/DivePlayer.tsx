"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DiverIcon, Icon } from "@/components/Icon";
import { fmtValue } from "@/lib/format";
import { WATERMARK_NOTE } from "@/lib/rights";

export type PlayerMarker = {
  id: string;
  label: string;
  kind: string;
  at: number;
  atSec: number;
};

type Props = {
  hasVideo: boolean;
  cmasEmbedOnly: boolean;
  footagePending: boolean;
  previewUrl?: string;
  posterUrl?: string;
  embedUrl?: string;
  eventLiveUrl?: string;
  cameras: string[];
  markers: PlayerMarker[];
  scene: { h: number; x: string; d: number };
  discipline: string;
  rp: number;
  card: string;
  ot: string;
  durationSec: number;
  /** Deep-link seek from `/dives/[id]?t=` (seconds). */
  initialSeekSec?: number | null;
};

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function DivePlayer({
  hasVideo,
  cmasEmbedOnly,
  footagePending,
  previewUrl,
  posterUrl,
  embedUrl,
  eventLiveUrl,
  cameras,
  markers,
  scene,
  discipline,
  rp,
  card,
  ot,
  durationSec,
  initialSeekSec = null,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [activeCam, setActiveCam] = useState(0);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const deepLinkApplied = useRef(false);
  // Prop from RSC, or client `?t=` (SSG pages may omit searchParams).
  const [seekTarget, setSeekTarget] = useState<number | null>(
    initialSeekSec != null && Number.isFinite(initialSeekSec)
      ? initialSeekSec
      : null,
  );

  const duration = durationSec || 1;

  const nearestMarkerId = useCallback(
    (atSec: number): string | undefined => {
      const nearest = markers.reduce<{ id: string; dist: number } | null>(
        (best, m) => {
          const dist = Math.abs(m.atSec - atSec);
          if (!best || dist < best.dist) return { id: m.id, dist };
          return best;
        },
        null,
      );
      return nearest && nearest.dist <= 2.5 ? nearest.id : undefined;
    },
    [markers],
  );

  const seekTo = useCallback(
    (atSec: number, markerId?: string) => {
      const v = videoRef.current;
      const capped = Math.min(Math.max(atSec, 0), v?.duration || duration);
      if (v) {
        try {
          v.currentTime = capped;
        } catch {
          // ignore NotSupportedError before metadata
        }
        void v.play().catch(() => undefined);
      }
      setCurrentSec(capped);
      setProgress(duration > 0 ? capped / duration : 0);
      setActiveMarker(markerId ?? nearestMarkerId(atSec) ?? null);
    },
    [duration, nearestMarkerId],
  );

  const applyDeepLink = useCallback(() => {
    if (
      deepLinkApplied.current ||
      seekTarget == null ||
      !Number.isFinite(seekTarget) ||
      seekTarget < 0
    ) {
      return;
    }
    deepLinkApplied.current = true;
    seekTo(seekTarget, nearestMarkerId(seekTarget));
  }, [seekTarget, nearestMarkerId, seekTo]);

  useEffect(() => {
    deepLinkApplied.current = false;
  }, [previewUrl, seekTarget]);

  useEffect(() => {
    if (initialSeekSec != null && Number.isFinite(initialSeekSec)) {
      setSeekTarget(initialSeekSec);
      return;
    }
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("t");
    if (raw == null || raw === "") return;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) setSeekTarget(n);
  }, [initialSeekSec]);

  // Keep clock / active marker in sync immediately (before media metadata).
  useEffect(() => {
    if (seekTarget == null || !hasVideo) return;
    setCurrentSec(seekTarget);
    setProgress(duration > 0 ? seekTarget / duration : 0);
    setActiveMarker(nearestMarkerId(seekTarget) ?? null);
  }, [hasVideo, seekTarget, duration, nearestMarkerId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const t = v.currentTime || 0;
      const d = v.duration || duration;
      setCurrentSec(t);
      setProgress(d > 0 ? t / d : 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => applyDeepLink();
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("loadedmetadata", onMeta);
    if (v.readyState >= 1) applyDeepLink();
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, [duration, previewUrl, applyDeepLink]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }, []);

  const streamUrl = embedUrl || eventLiveUrl;
  const pct = Math.min(100, Math.max(0, progress * 100));

  return (
    <div>
      <div className="player">
        {hasVideo && previewUrl ? (
          <div className="player-media">
            <video
              ref={videoRef}
              className="player-video"
              poster={posterUrl || "/video/poster.jpg"}
              preload="auto"
              playsInline
              controls={false}
              onLoadedMetadata={applyDeepLink}
            >
              <source src={previewUrl} type="video/mp4" />
            </video>
            <span className="wm player-wm">DEPTHBOARD</span>
          </div>
        ) : (
          <div
            className="scene"
            style={
              {
                "--h": scene.h,
                "--x": scene.x,
                "--d": scene.d,
              } as React.CSSProperties
            }
          >
            <span className="rope" />
            <span className="diver" aria-hidden="true">
              <DiverIcon />
            </span>
            <span className="wm">
              {cmasEmbedOnly ? "CMAS EMBED" : "DEPTHBOARD"}
            </span>
          </div>
        )}

        <div className="chips" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {hasVideo ? (
            <span className="badge" style={{ background: "rgba(0,0,0,.55)" }}>
              Preview · watermarked
            </span>
          ) : cmasEmbedOnly ? (
            <span className="badge" style={{ background: "rgba(0,0,0,.55)" }}>
              CMAS embed-only
            </span>
          ) : (
            <span className="badge" style={{ background: "rgba(0,0,0,.55)" }}>
              Footage pending
            </span>
          )}
        </div>

        <div className="hud">
          <b className="num">
            {card === "R" ? "DQ" : fmtValue(discipline, rp)}
          </b>
          OT {ot} · {discipline}
        </div>

        <div className="ovl">
          {hasVideo && previewUrl ? (
            !playing ? (
              <button
                className="bigplay"
                type="button"
                aria-label="Play preview"
                onClick={togglePlay}
              >
                <Icon name="play" filled />
              </button>
            ) : null
          ) : cmasEmbedOnly ? (
            <div
              className="card"
              style={{
                padding: 18,
                maxWidth: 380,
                textAlign: "center",
                background: "rgba(8,16,22,.88)",
              }}
            >
              <p style={{ marginBottom: 12, color: "#e8f4f7" }}>
                CMAS transmission — Diveye hosts an embed / link only. No HQ
                file sale.
              </p>
              {streamUrl ? (
                <a
                  className="btn btn--light btn--sm"
                  href={streamUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open external stream
                </a>
              ) : (
                <span className="small muted">Stream URL pending</span>
              )}
            </div>
          ) : (
            <div
              className="card"
              style={{
                padding: 18,
                maxWidth: 360,
                textAlign: "center",
                background: "rgba(8,16,22,.88)",
              }}
            >
              <p style={{ marginBottom: 12, color: "#e8f4f7" }}>
                {footagePending
                  ? "Footage pending — no Diveye OT asset matched for this official top yet."
                  : "Diveye footage is not linked for this performance yet."}
              </p>
              <Link className="btn btn--light btn--sm" href="/archive">
                Browse archive status
              </Link>
            </div>
          )}
        </div>
      </div>

      <div
        className="player-bar"
        style={{
          border: "1px solid var(--line-soft)",
          borderTop: 0,
          borderRadius: "0 0 var(--r-lg) var(--r-lg)",
        }}
      >
        {hasVideo && markers.length > 0 ? (
          <>
            <div className="row row--between" style={{ marginBottom: 4 }}>
              <span className="small muted num">
                {fmtClock(currentSec)} / {fmtClock(duration)}
              </span>
              {activeMarker && (
                <span className="small">
                  Marker:{" "}
                  {markers.find((m) => m.id === activeMarker)?.label ?? "—"}
                </span>
              )}
            </div>
            <div className="timeline" aria-label="Dive timeline">
              <div className="track" />
              <div className="prog" style={{ width: `${pct}%` }} />
              <div className="head" style={{ left: `${pct}%` }} />
              {markers.map((m) => {
                const warn =
                  m.kind === "penalty" ||
                  m.kind === "bo" ||
                  m.kind === "blackout";
                const cardMk = m.kind === "card";
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`mk${cardMk ? " mk--card" : ""}${warn ? " mk--warn" : ""}`}
                    style={{ left: `${m.at * 100}%` }}
                    title={`${m.label} · ${fmtClock(m.atSec)}`}
                    aria-label={`Seek to ${m.label}`}
                    onClick={() => seekTo(m.atSec, m.id)}
                  >
                    <i />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ padding: "12px 14px" }} className="small muted">
            {cmasEmbedOnly
              ? "No Diveye OT markers — use the external CMAS stream."
              : "OT markers appear when Diveye archive footage is attached to this dive."}
          </div>
        )}

        <div className="cams" role="group" aria-label="Camera">
          {cameras.length > 0 ? (
            cameras.map((c, i) => (
              <button
                key={c}
                className="chip"
                type="button"
                aria-pressed={i === activeCam}
                onClick={() => setActiveCam(i)}
              >
                {i === activeCam && <Icon name="camera" />} {c}
              </button>
            ))
          ) : (
            <span className="chip" aria-disabled>
              Cameras pending
            </span>
          )}
          <span className="source" style={{ marginLeft: "auto" }}>
            {cmasEmbedOnly
              ? "CMAS stream embed policy"
              : hasVideo
                ? "Footage by Diveye"
                : "Result from federation ingest"}
          </span>
        </div>

        {hasVideo && (
          <p className="caption" style={{ padding: "0 14px 12px" }}>
            {WATERMARK_NOTE}
          </p>
        )}
      </div>
    </div>
  );
}
