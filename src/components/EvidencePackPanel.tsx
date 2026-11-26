"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { JUDGE_TAG_LABELS } from "@/lib/federation-score";
import type { JudgeEvidencePack, JudgeEvidenceTag } from "@/types/domain";

export type EvidenceMarkerRow = {
  id: string;
  label: string;
  kind: string;
  atSec: number;
};

export function EvidencePackPanel({
  pack,
  previewUrl,
  posterUrl,
  markers,
  allAssetMarkers,
}: {
  pack: JudgeEvidencePack;
  previewUrl?: string;
  posterUrl?: string;
  markers: EvidenceMarkerRow[];
  allAssetMarkers: EvidenceMarkerRow[];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [panelTags, setPanelTags] = useState<JudgeEvidenceTag[]>(pack.tags);

  function seek(atSec: number, id: string) {
    const v = videoRef.current;
    setActive(id);
    if (!v) return;
    v.currentTime = Math.max(0, atSec);
    void v.play().catch(() => undefined);
  }

  function toggleTag(t: JudgeEvidenceTag) {
    setPanelTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  return (
    <div className="fed-ev">
      <header className="fed-quiz__head">
        <p className="fed-quiz__eyebrow">
          {pack.mode === "async" ? "Async evidence" : "On-site (stub)"} ·{" "}
          {pack.federation} · {pack.discipline}
        </p>
        <h1 className="fed-quiz__title">{pack.title}</h1>
        <p className="muted">{pack.notes}</p>
      </header>

      <section className="fed-quiz__card">
        <h2>
          <Icon name="film" /> FootageAsset
        </h2>
        <p className="muted small">
          <code>{pack.footageAssetId}</code>
          {pack.diveId ? (
            <>
              {" "}
              ·{" "}
              <Link href={`/dives/${pack.diveId}`}>Dive {pack.diveId}</Link>
            </>
          ) : null}
        </p>
        {previewUrl ? (
          <video
            ref={videoRef}
            className="fed-quiz__video"
            controls
            playsInline
            poster={posterUrl}
            src={previewUrl}
          />
        ) : (
          <p className="muted">
            No local preview (CMAS embed / missing key). Use dive page for
            playback when available.
          </p>
        )}
      </section>

      <section className="fed-quiz__card" aria-labelledby="fed-markers-h">
        <h2 id="fed-markers-h">Highlighted markers</h2>
        {markers.length === 0 ? (
          <p className="muted small">
            Pack has no marker subset — full asset markers below if any.
          </p>
        ) : (
          <div className="fed-quiz__markers">
            {markers.map((m) => (
              <button
                key={m.id}
                type="button"
                className={active === m.id ? "fed-marker is-active" : "fed-marker"}
                onClick={() => seek(m.atSec, m.id)}
              >
                <span className="fed-marker__kind">{m.kind}</span>
                <span>{m.label}</span>
                <span className="muted">{m.atSec}s</span>
              </button>
            ))}
          </div>
        )}
        {allAssetMarkers.length > markers.length ? (
          <>
            <h3 className="fed-ev__subh">All asset markers</h3>
            <div className="fed-quiz__markers">
              {allAssetMarkers.map((m) => (
                <button
                  key={`all-${m.id}`}
                  type="button"
                  className={
                    active === m.id ? "fed-marker is-active" : "fed-marker"
                  }
                  onClick={() => seek(m.atSec, m.id)}
                >
                  <span className="fed-marker__kind">{m.kind}</span>
                  <span>{m.label}</span>
                  <span className="muted">{m.atSec}s</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="fed-quiz__card" aria-labelledby="fed-panel-h">
        <h2 id="fed-panel-h">
          <Icon name="flag" /> Judge panel tags
        </h2>
        <p className="muted small">
          Seed tags pre-selected. Toggle locally for async review practice
          (not persisted).
        </p>
        <div className="fed-tag-grid">
          {(Object.keys(JUDGE_TAG_LABELS) as JudgeEvidenceTag[]).map((t) => (
            <label
              key={t}
              className={panelTags.includes(t) ? "fed-tag is-on" : "fed-tag"}
            >
              <input
                type="checkbox"
                checked={panelTags.includes(t)}
                onChange={() => toggleTag(t)}
              />
              {JUDGE_TAG_LABELS[t]}
            </label>
          ))}
        </div>
      </section>

      <p className="caption">
        On-site hybrid panel (live tagging during the attempt) ships later —
        async evidence UI first.
      </p>
    </div>
  );
}
