"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { CoachFinding, CoachReport } from "@/types/domain";

const DISCLAIMER =
  "Training aid only — not medical advice and not a substitute for in-water safety, a qualified coach, or federation rules.";

function FindingList({
  title,
  items,
  tone,
}: {
  title: string;
  items: CoachFinding[];
  tone: "ok" | "warn" | "drill";
}) {
  if (items.length === 0) return null;
  const cls =
    tone === "ok"
      ? "coach-findings coach-findings--ok"
      : tone === "warn"
        ? "coach-findings coach-findings--warn"
        : "coach-findings coach-findings--drill";
  return (
    <div className={cls}>
      <h4>{title}</h4>
      <ul>
        {items.map((f) => (
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
  );
}

export function CoachAnalyzePanel({
  diveId,
  athleteName,
  canAnalyze,
  canView,
  existing,
}: {
  diveId: string;
  athleteName: string;
  canAnalyze: boolean;
  canView: boolean;
  existing: CoachReport[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState("");
  const [latest, setLatest] = useState<CoachReport | null>(
    existing[0] ?? null,
  );

  if (!canAnalyze && !canView) {
    return null;
  }

  async function runAnalyze() {
    setStatus("running");
    setMessage("");
    try {
      const res = await fetch("/api/coach/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diveId }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report?: CoachReport;
      };
      if (!res.ok || !json.ok || !json.report) {
        throw new Error(json.error || "Analyze failed");
      }
      setLatest(json.report);
      setStatus("idle");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Analyze failed");
    }
  }

  const report = latest;
  const strengths = report?.findings.filter((f) => f.kind === "strength") ?? [];
  const issues = report?.findings.filter((f) => f.kind === "issue") ?? [];
  const drills = report?.findings.filter((f) => f.kind === "drill") ?? [];

  return (
    <div className="coach-panel card" style={{ padding: 20 }}>
      <div className="row row--between row--wrap" style={{ gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>AI coach</h3>
          <p className="muted small" style={{ marginTop: 6 }}>
            Private feedback for {athleteName} — markers + mock depth/time.
          </p>
        </div>
        {canAnalyze && (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={status === "running"}
            onClick={runAnalyze}
          >
            {status === "running" ? "Analyzing…" : "Analyze with AI coach"}
          </button>
        )}
      </div>

      <p className="coach-disclaimer" role="note">
        <Icon name="info" /> {DISCLAIMER}
      </p>

      {status === "error" && (
        <p className="caption" style={{ color: "var(--danger, #c44)" }}>
          {message}
        </p>
      )}

      {report ? (
        <div className="coach-report" style={{ marginTop: 14 }}>
          <div className="row row--wrap" style={{ gap: 8, marginBottom: 10 }}>
            <span className="badge">engine · {report.engine}</span>
            <span className="badge">private</span>
            <Link className="small" href={`/account/coach/${report.id}`}>
              Open report
            </Link>
          </div>
          <p className="small">{report.summary}</p>
          {report.telemetrySnapshot && (
            <dl className="coach-tel">
              {report.telemetrySnapshot.maxDepthM != null && (
                <>
                  <dt>Mock max depth</dt>
                  <dd className="num">{report.telemetrySnapshot.maxDepthM} m</dd>
                </>
              )}
              {report.telemetrySnapshot.diveTimeSec != null && (
                <>
                  <dt>Dive time</dt>
                  <dd className="num">
                    {report.telemetrySnapshot.diveTimeSec}s
                  </dd>
                </>
              )}
              {report.telemetrySnapshot.turnAtSec != null && (
                <>
                  <dt>Turn</dt>
                  <dd className="num">{report.telemetrySnapshot.turnAtSec}s</dd>
                </>
              )}
            </dl>
          )}
          <FindingList title="What improved" items={strengths} tone="ok" />
          <FindingList title="What went wrong" items={issues} tone="warn" />
          <FindingList title="Drills" items={drills} tone="drill" />
        </div>
      ) : (
        <p className="muted small" style={{ marginTop: 12 }}>
          {canAnalyze
            ? "No report yet — run analysis to generate private findings."
            : "No private reports for this dive yet."}
        </p>
      )}

      <p className="caption" style={{ marginTop: 12 }}>
        All reports: <Link href="/account/coach">/account/coach</Link>
      </p>
    </div>
  );
}
