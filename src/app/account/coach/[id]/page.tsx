import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { COACH_DISCLAIMER, getCoachReport } from "@/lib/coach";
import { fmtDate } from "@/lib/format";
import { getRepository } from "@/lib/repository";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Coach report ${id}`,
    robots: { index: false, follow: false },
  };
}

export default async function CoachReportPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) {
    return (
      <div className="container section">
        <p className="muted">
          Sign in required.{" "}
          <Link href="/login?next=/account/coach">Sign in</Link>
        </p>
      </div>
    );
  }

  const { id } = await params;
  const report = getCoachReport(id, session);
  if (!report) notFound();

  const repo = getRepository();
  const athlete = repo.getAthleteBySlug(report.athleteSlug);
  const strengths = report.findings.filter((f) => f.kind === "strength");
  const issues = report.findings.filter((f) => f.kind === "issue");
  const drills = report.findings.filter((f) => f.kind === "drill");

  return (
    <div className="container section coach-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <Link href="/account">Account</Link>
        <Icon name="chev-r" />
        <Link href="/account/coach">AI coach</Link>
        <Icon name="chev-r" />
        <span aria-current="page">{report.id}</span>
      </nav>

      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Private · {report.engine}</p>
          <h1>Coach report</h1>
          <p>
            {athlete?.name ?? report.athleteSlug} ·{" "}
            <Link href={`/dives/${report.diveId}`}>{report.diveId}</Link> ·{" "}
            {fmtDate(report.createdAt.slice(0, 10))}
          </p>
        </div>
      </div>

      <p className="coach-disclaimer" role="note">
        <Icon name="info" /> {report.disclaimer || COACH_DISCLAIMER}
      </p>

      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <h2 style={{ fontSize: "1.1rem" }}>Summary</h2>
        <p className="small" style={{ marginTop: 8 }}>
          {report.summary}
        </p>
        {report.telemetrySnapshot && (
          <dl className="coach-tel" style={{ marginTop: 14 }}>
            {report.telemetrySnapshot.maxDepthM != null && (
              <>
                <dt>Mock max depth</dt>
                <dd className="num">{report.telemetrySnapshot.maxDepthM} m</dd>
              </>
            )}
            {report.telemetrySnapshot.diveTimeSec != null && (
              <>
                <dt>Dive time</dt>
                <dd className="num">{report.telemetrySnapshot.diveTimeSec}s</dd>
              </>
            )}
            {report.footageAssetId && (
              <>
                <dt>FootageAsset</dt>
                <dd>
                  <code>{report.footageAssetId}</code>
                </dd>
              </>
            )}
          </dl>
        )}
      </div>

      {[
        { title: "What improved", items: strengths, cls: "coach-findings--ok" },
        { title: "What went wrong", items: issues, cls: "coach-findings--warn" },
        { title: "Drills", items: drills, cls: "coach-findings--drill" },
      ].map((block) =>
        block.items.length === 0 ? null : (
          <div
            key={block.title}
            className={`coach-findings ${block.cls} card`}
            style={{ padding: 20, marginTop: 14 }}
          >
            <h3 style={{ fontSize: "1.05rem", margin: 0 }}>{block.title}</h3>
            <ul style={{ marginTop: 10 }}>
              {block.items.map((f) => (
                <li key={f.id}>
                  <strong>{f.title}</strong>
                  <span className="fine">{f.detail}</span>
                  {typeof f.atSec === "number" && (
                    <span className="caption">@{f.atSec}s</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
