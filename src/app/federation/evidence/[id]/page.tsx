import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvidencePackPanel } from "@/components/EvidencePackPanel";
import {
  FederationCrumbs,
  FederationGateHint,
} from "@/components/FederationShell";
import { canAccessFederation, getSession } from "@/lib/auth";
import { resolveEvidencePack } from "@/lib/federation";
import { loadFootageCatalog } from "@/lib/footage";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const resolved = resolveEvidencePack(id);
  return {
    title: resolved ? resolved.pack.title : "Evidence pack",
    robots: { index: false, follow: false },
  };
}

export default async function FederationEvidencePackPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return (
      <div className="container section">
        <p>
          Sign in required.{" "}
          <Link href={`/login?next=/federation/evidence/${id}`}>
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
            { href: "/federation/evidence", label: "Evidence" },
            { label: id },
          ]}
        />
        <FederationGateHint email={session.email} role={session.role} />
      </div>
    );
  }

  const resolved = resolveEvidencePack(id);
  if (!resolved) notFound();

  const catalog = loadFootageCatalog();
  const asset =
    catalog.assets.find((a) => a.id === resolved.pack.footageAssetId) ?? null;
  const allAssetMarkers = (asset?.markers ?? []).map((m) => ({
    id: m.id,
    label: m.label,
    kind: m.kind,
    atSec: m.atSec,
  }));

  return (
    <div className="container section fed-page">
      <FederationCrumbs
        trail={[
          { href: "/federation", label: "Federation" },
          { href: "/federation/evidence", label: "Evidence" },
          { label: resolved.pack.title },
        ]}
      />
      <EvidencePackPanel
        pack={resolved.pack}
        previewUrl={resolved.previewUrl}
        posterUrl={resolved.posterUrl}
        markers={resolved.markers.map((m) => ({
          id: m.id,
          label: m.label,
          kind: m.kind,
          atSec: m.atSec,
        }))}
        allAssetMarkers={allAssetMarkers}
      />
      <p style={{ marginTop: 16 }}>
        <Link className="btn btn--ghost" href="/federation/evidence">
          All packs
        </Link>
      </p>
    </div>
  );
}
