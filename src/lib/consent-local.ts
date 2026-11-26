import type { ConsentPurpose, ConsentStatus } from "@/types/domain";

export type LocalConsentState = {
  consents?: Partial<Record<ConsentPurpose, ConsentStatus>>;
  guardianConsentGranted?: boolean;
};

export function readLocalConsents(athleteSlug: string): LocalConsentState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`depthboard:consents:${athleteSlug}`);
    if (!raw) return {};
    return JSON.parse(raw) as LocalConsentState;
  } catch {
    return {};
  }
}

export function localConsentGranted(
  state: LocalConsentState,
  purpose: ConsentPurpose,
  seedGranted: boolean,
): boolean {
  const override = state.consents?.[purpose];
  if (override === "granted") return true;
  if (override === "withdrawn" || override === "missing") return false;
  return seedGranted;
}
