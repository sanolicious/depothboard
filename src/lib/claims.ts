import type { ClaimRequest, SessionUser } from "@/types/domain";
import { getRepository } from "@/lib/repository";

/** Athlete linked on the user record, or from an approved claim for this account. */
export function resolveAthleteSlug(
  session: SessionUser,
  claims?: ClaimRequest[],
): string | null {
  if (session.athleteSlug) return session.athleteSlug;
  const list = claims ?? getRepository().listClaimRequests();
  const approved = list
    .filter(
      (c) =>
        c.status === "approved" &&
        !!c.athleteSlug &&
        (c.userId === session.id ||
          c.email.toLowerCase() === session.email.toLowerCase()),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return approved[0]?.athleteSlug ?? null;
}

export function claimsForUser(
  session: SessionUser,
  claims?: ClaimRequest[],
): ClaimRequest[] {
  const list = claims ?? getRepository().listClaimRequests();
  return list
    .filter(
      (c) =>
        c.userId === session.id ||
        c.email.toLowerCase() === session.email.toLowerCase(),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
