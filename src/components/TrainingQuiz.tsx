"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CardBadge } from "@/components/CardBadge";
import { Icon } from "@/components/Icon";
import {
  ALL_JUDGE_TAGS,
  JUDGE_TAG_LABELS,
  scoreJudgeQuiz,
} from "@/lib/federation-score";
import { cardLabel } from "@/lib/format";
import type {
  Card,
  JudgeEvidenceTag,
  JudgeTrainingCase,
} from "@/types/domain";

export type TrainingQuizEvidence = {
  packId: string;
  packTitle: string;
  previewUrl?: string;
  posterUrl?: string;
  markers: Array<{ id: string; label: string; kind: string; atSec: number }>;
  footageAssetId: string;
  diveId?: string;
};

const CARDS: Card[] = ["W", "Y", "R"];

export function TrainingQuiz({
  caseData,
  evidence,
}: {
  caseData: JudgeTrainingCase;
  evidence: TrainingQuizEvidence | null;
}) {
  const [card, setCard] = useState<Card | null>(null);
  const [tags, setTags] = useState<JudgeEvidenceTag[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const score = useMemo(() => {
    if (!submitted || !card) return null;
    return scoreJudgeQuiz(
      caseData.referenceCard,
      caseData.referenceTags,
      card,
      tags,
    );
  }, [submitted, card, tags, caseData.referenceCard, caseData.referenceTags]);

  function toggleTag(t: JudgeEvidenceTag) {
    if (submitted) return;
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!card) return;
    setSubmitted(true);
  }

  function reset() {
    setCard(null);
    setTags([]);
    setSubmitted(false);
    setActiveMarker(null);
  }

  return (
    <div className="fed-quiz">
      <header className="fed-quiz__head">
        <p className="fed-quiz__eyebrow">
          Async review · {caseData.federation} · {caseData.discipline}
        </p>
        <h1 className="fed-quiz__title">{caseData.title}</h1>
        <p className="fed-quiz__meta">
          <span className={`fed-diff fed-diff--${caseData.difficulty}`}>
            {caseData.difficulty}
          </span>
          <span>{caseData.anonymizedAthlete}</span>
          <span className="muted">{caseData.summary}</span>
        </p>
      </header>

      <section className="fed-quiz__card" aria-labelledby="fed-scenario-h">
        <h2 id="fed-scenario-h">Scenario</h2>
        <p>{caseData.scenario}</p>
        <ul className="fed-quiz__briefing">
          {caseData.briefing.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {caseData.ruleHints?.length ? (
          <p className="fed-quiz__hints">
            <Icon name="info" /> {caseData.ruleHints.join(" · ")}
          </p>
        ) : null}
      </section>

      {evidence ? (
        <section className="fed-quiz__card" aria-labelledby="fed-ev-h">
          <h2 id="fed-ev-h">
            <Icon name="film" /> Evidence pack
          </h2>
          <p className="muted small">
            {evidence.packTitle} · <code>{evidence.footageAssetId}</code>
            {evidence.diveId ? (
              <>
                {" "}
                · dive{" "}
                <Link href={`/dives/${evidence.diveId}`}>{evidence.diveId}</Link>
              </>
            ) : null}
          </p>
          {evidence.previewUrl ? (
            <video
              className="fed-quiz__video"
              controls
              playsInline
              poster={evidence.posterUrl}
              src={evidence.previewUrl}
            />
          ) : (
            <p className="muted">No preview URL for this FootageAsset.</p>
          )}
          {evidence.markers.length > 0 ? (
            <div className="fed-quiz__markers" role="list">
              {evidence.markers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="listitem"
                  className={
                    activeMarker === m.id
                      ? "fed-marker is-active"
                      : "fed-marker"
                  }
                  onClick={() => setActiveMarker(m.id)}
                >
                  <span className="fed-marker__kind">{m.kind}</span>
                  <span>{m.label}</span>
                  <span className="muted">{m.atSec}s</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small">No highlighted markers on this pack.</p>
          )}
          <Link
            className="btn btn--ghost"
            href={`/federation/evidence/${evidence.packId}`}
          >
            Open evidence pack
          </Link>
        </section>
      ) : (
        <p className="banner banner--danger">Evidence pack missing in seed.</p>
      )}

      <form className="fed-quiz__card" onSubmit={onSubmit}>
        <h2>Your call</h2>
        <p className="muted small">
          Pick white / yellow / red, then tag what you see. Scored against the
          seed reference after submit.
        </p>
        <fieldset className="fed-quiz__cards" disabled={submitted}>
          <legend className="sr-only">Card</legend>
          {CARDS.map((c) => (
            <button
              key={c}
              type="button"
              className={
                card === c ? "fed-card-pick is-selected" : "fed-card-pick"
              }
              onClick={() => setCard(c)}
              aria-pressed={card === c}
              title={cardLabel(c)}
            >
              <CardBadge card={c} large />
              <span>{c === "W" ? "White" : c === "Y" ? "Yellow" : "Red"}</span>
            </button>
          ))}
        </fieldset>

        <fieldset className="fed-quiz__tags" disabled={submitted}>
          <legend>Evidence tags</legend>
          <div className="fed-tag-grid">
            {ALL_JUDGE_TAGS.map((t) => (
              <label
                key={t}
                className={
                  tags.includes(t) ? "fed-tag is-on" : "fed-tag"
                }
              >
                <input
                  type="checkbox"
                  checked={tags.includes(t)}
                  onChange={() => toggleTag(t)}
                />
                {JUDGE_TAG_LABELS[t]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="fed-quiz__actions">
          {!submitted ? (
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!card}
            >
              Submit vs reference
            </button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={reset}>
              Try again
            </button>
          )}
          <Link className="btn btn--ghost" href="/federation/training">
            All cases
          </Link>
        </div>
      </form>

      {score && card ? (
        <section
          className="fed-quiz__card fed-quiz__score"
          aria-live="polite"
          aria-labelledby="fed-score-h"
        >
          <h2 id="fed-score-h">Score · {score.percent}%</h2>
          <div className="fed-score-row">
            <div>
              <p className="muted small">Your card</p>
              <CardBadge card={card} large />
            </div>
            <div>
              <p className="muted small">Reference</p>
              <CardBadge card={caseData.referenceCard} large />
            </div>
            <div>
              <p className="muted small">Card match</p>
              <strong>{score.cardMatch ? "Yes" : "No"}</strong>
            </div>
            <div>
              <p className="muted small">Tag F1</p>
              <strong>{(score.tagF1 * 100).toFixed(0)}%</strong>
            </div>
          </div>
          <p>{caseData.referenceRationale}</p>
          {score.missedTags.length > 0 ? (
            <p className="muted small">
              Missed tags:{" "}
              {score.missedTags.map((t) => JUDGE_TAG_LABELS[t]).join(", ")}
            </p>
          ) : null}
          {score.extraTags.length > 0 ? (
            <p className="muted small">
              Extra tags:{" "}
              {score.extraTags.map((t) => JUDGE_TAG_LABELS[t]).join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="caption fed-quiz__onsite">
        Hybrid note: this MVP is <strong>async UI first</strong>. On-site judge
        panel (live tags during the attempt) is stubbed for a later pass — not
        AI coach (PWF-21).
      </p>
    </div>
  );
}
