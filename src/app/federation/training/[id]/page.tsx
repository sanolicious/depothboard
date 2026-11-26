import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  FederationCrumbs,
  FederationGateHint,
} from "@/components/FederationShell";
import { TrainingQuiz } from "@/components/TrainingQuiz";
import { canAccessFederation, getSession } from "@/lib/auth";
import { getTrainingCase, resolveEvidencePack } from "@/lib/federation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = getTrainingCase(id);
  return {
    title: c ? c.title : "Training case",
    robots: { index: false, follow: false },
  };
}

export default async function FederationTrainingCasePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return (
      <div className="container section">
        <p>
          Sign in required.{" "}
          <Link href={`/login?next=/federation/training/${id}`}>
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  if (!canAccessFederation(session)) {
    return (
      <div className="container section fed-page">
        <FederationCrumbs
          trail={[
            { href: "/federation", label: "Federation" },
            { href: "/federation/training", label: "Training" },
            { label: id },
          ]}
        />
        <FederationGateHint email={session.email} role={session.role} />
      </div>
    );
  }

  const caseData = getTrainingCase(id);
  if (!caseData) notFound();

  const resolved = resolveEvidencePack(caseData.evidencePackId);
  const evidence = resolved
    ? {
        packId: resolved.pack.id,
        packTitle: resolved.pack.title,
        previewUrl: resolved.previewUrl,
        posterUrl: resolved.posterUrl,
        footageAssetId: resolved.pack.footageAssetId,
        diveId: resolved.pack.diveId,
        markers: resolved.markers.map((m) => ({
          id: m.id,
          label: m.label,
          kind: m.kind,
          atSec: m.atSec,
        })),
      }
    : null;

  return (
    <div className="container section fed-page">
      <FederationCrumbs
        trail={[
          { href: "/federation", label: "Federation" },
          { href: "/federation/training", label: "Training" },
          { label: caseData.title },
        ]}
      />
      <TrainingQuiz caseData={caseData} evidence={evidence} />
    </div>
  );
}
