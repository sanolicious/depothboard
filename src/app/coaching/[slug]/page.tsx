import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookSessionForm } from "@/components/BookSessionForm";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import {
  COACHING_DISCLAIMER,
  DIVYE_COACHING_COMMISSION_PERCENT,
  fmtSlotRange,
  getCoachProfileBySlug,
  listPackagesForCoach,
  listSlotsForCoach,
} from "@/lib/coaching-marketplace";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = getCoachProfileBySlug(slug);
  if (!profile) return { title: "Coach" };
  return {
    title: `${profile.name} · Coaching`,
    description: profile.headline,
    alternates: { canonical: `/coaching/${profile.slug}` },
  };
}

export default async function CoachProfilePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const profile = getCoachProfileBySlug(slug);
  if (!profile || !profile.active) notFound();

  const session = await getSession();
  const packages = listPackagesForCoach(profile.slug);
  const slots = listSlotsForCoach(profile.slug);
  const openSlots = slots.filter((s) => s.status === "open");
  const loginNext = `/coaching/${profile.slug}`;

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <Link href="/coaching">Coaching</Link>
        <Icon name="chev-r" />
        <span aria-current="page">{profile.name}</span>
      </nav>

      <div
        aria-hidden
        style={{
          marginTop: 16,
          height: 140,
          borderRadius: "var(--r-lg)",
          background: `linear-gradient(135deg, hsl(${profile.photoHue} 42% 28%), hsl(${(profile.photoHue + 40) % 360} 35% 14%))`,
        }}
      />

      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>{profile.name}</h1>
          <p>{profile.headline}</p>
          <p className="caption" style={{ marginTop: 8 }}>
            {profile.location} · {profile.languages.join(", ")} ·{" "}
            {profile.specialties.join(" · ")}
          </p>
        </div>
        <Link className="btn btn--ghost" href="/coaching">
          All coaches
        </Link>
      </div>

      <p className="coach-disclaimer" role="note">
        <Icon name="info" /> {COACHING_DISCLAIMER}
      </p>

      <div className="grid grid-2" style={{ marginTop: 20, gap: 16 }}>
        <div>
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: "1.15rem" }}>About</h2>
            <p className="small" style={{ marginTop: 10, lineHeight: 1.55 }}>
              {profile.bio}
            </p>
          </div>

          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <h2 style={{ fontSize: "1.15rem" }}>Packages (EUR)</h2>
            {packages.length === 0 ? (
              <p className="muted small" style={{ marginTop: 8 }}>
                No packages seeded.
              </p>
            ) : (
              <ul style={{ marginTop: 12, paddingLeft: 18 }}>
                {packages.map((pkg) => (
                  <li key={pkg.id} style={{ marginBottom: 12 }}>
                    <strong className="small">{pkg.title}</strong>
                    <span className="muted small">
                      {" "}
                      · €{pkg.priceEur} · {pkg.durationMin} min · {pkg.kind}
                    </span>
                    <div className="caption">{pkg.description}</div>
                  </li>
                ))}
              </ul>
            )}
            <p className="caption" style={{ marginTop: 8 }}>
              Diveye commission {DIVYE_COACHING_COMMISSION_PERCENT}% is deducted
              from the listed price at booking (
              <code>DIVYE_COACHING_COMMISSION_PERCENT</code>).
            </p>
          </div>

          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <h2 style={{ fontSize: "1.15rem" }}>Open slots</h2>
            {openSlots.length === 0 ? (
              <p className="muted small" style={{ marginTop: 8 }}>
                Fully booked in the seed window.
              </p>
            ) : (
              <ul style={{ marginTop: 12, paddingLeft: 18 }}>
                {openSlots.map((s) => (
                  <li key={s.id} className="small" style={{ marginBottom: 6 }}>
                    {fmtSlotRange(s.startsAt, s.endsAt)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <BookSessionForm
          coachSlug={profile.slug}
          packages={packages}
          slots={slots}
          signedIn={Boolean(session)}
          commissionPercent={DIVYE_COACHING_COMMISSION_PERCENT}
          loginNext={loginNext}
        />
      </div>
    </div>
  );
}
