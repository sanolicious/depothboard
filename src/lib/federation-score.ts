import type { Card, JudgeEvidenceTag } from "@/types/domain";

export const JUDGE_TAG_LABELS: Record<JudgeEvidenceTag, string> = {
  early_start: "Early start",
  late_start: "Late start",
  surface_protocol: "Surface protocol",
  blackout: "Blackout / BO watch",
  grab: "Grab / pull",
  lane_line: "Lane line",
  turn: "Turn / bottom",
  depth_marker: "Depth marker / tag",
  airway: "Airway",
  other: "Other",
};

export const ALL_JUDGE_TAGS = Object.keys(
  JUDGE_TAG_LABELS,
) as JudgeEvidenceTag[];

export type QuizScore = {
  cardMatch: boolean;
  tagPrecision: number;
  tagRecall: number;
  tagF1: number;
  matchedTags: JudgeEvidenceTag[];
  missedTags: JudgeEvidenceTag[];
  extraTags: JudgeEvidenceTag[];
  /** 0–100 composite: 70% card + 30% tag F1. */
  percent: number;
};

/** Score a white/yellow/red quiz attempt against the seed reference. */
export function scoreJudgeQuiz(
  referenceCard: Card,
  referenceTags: JudgeEvidenceTag[],
  selectedCard: Card,
  selectedTags: JudgeEvidenceTag[],
): QuizScore {
  const cardMatch = referenceCard === selectedCard;
  const ref = new Set(referenceTags);
  const sel = new Set(selectedTags);
  const matchedTags = [...sel].filter((t) => ref.has(t));
  const missedTags = [...ref].filter((t) => !sel.has(t));
  const extraTags = [...sel].filter((t) => !ref.has(t));
  const tagPrecision =
    sel.size === 0 ? (ref.size === 0 ? 1 : 0) : matchedTags.length / sel.size;
  const tagRecall = ref.size === 0 ? 1 : matchedTags.length / ref.size;
  const tagF1 =
    tagPrecision + tagRecall === 0
      ? 0
      : (2 * tagPrecision * tagRecall) / (tagPrecision + tagRecall);
  const percent = Math.round(70 * (cardMatch ? 1 : 0) + 30 * tagF1);
  return {
    cardMatch,
    tagPrecision,
    tagRecall,
    tagF1,
    matchedTags,
    missedTags,
    extraTags,
    percent,
  };
}
