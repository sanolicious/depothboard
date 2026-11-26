"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CardBadge } from "@/components/CardBadge";
import { CountryChip } from "@/components/CountryChip";
import { Icon } from "@/components/Icon";
import { fmtValue } from "@/lib/format";
import type { Performance, ResultStatus } from "@/types/domain";

type AthleteLite = {
  slug: string;
  name: string;
  country: string;
  neutral: boolean;
};

type TabKey = "all" | "provisional" | "unofficial" | "official";

type ApiPayload = {
  ok: boolean;
  count: number;
  refreshedAt: string;
  pollIntervalSec?: number;
  results: Performance[];
  athletes: Record<string, AthleteLite>;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "provisional", label: "Live / provisional" },
  { key: "unofficial", label: "Unofficial" },
  { key: "official", label: "Official" },
];

function statusClass(status: ResultStatus, eventLive: boolean): string {
  if (status === "official") return "status status--official";
  if (status === "unofficial") return "status status--unofficial";
  if (eventLive && status === "provisional") return "status status--live";
  return "status status--prov";
}

function statusLabel(status: ResultStatus, eventLive: boolean): string {
  if (status === "official") return "official";
  if (status === "unofficial") return "unofficial";
  if (eventLive && status === "provisional") return "live";
  return "provisional";
}

function countsOf(rows: Performance[]) {
  return {
    all: rows.length,
    provisional: rows.filter((r) => r.status === "provisional").length,
    unofficial: rows.filter((r) => r.status === "unofficial").length,
    official: rows.filter((r) => r.status === "official").length,
  };
}

export function EventResultsPanel({
  eventId,
  eventLive = false,
  initialResults,
  initialAthletes,
}: {
  eventId: string;
  eventLive?: boolean;
  initialResults: Performance[];
  initialAthletes: Record<string, AthleteLite>;
}) {
  const [tab, setTab] = useState<TabKey>("all");
  const [results, setResults] = useState(initialResults);
  const [athletes, setAthletes] = useState(initialAthletes);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPolling(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/results?limit=120`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiPayload;
      if (!data.ok) throw new Error("bad payload");
      setResults(data.results);
      setAthletes(data.athletes);
      setRefreshedAt(data.refreshedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "refresh failed");
    } finally {
      setPolling(false);
    }
  }, [eventId]);

  useEffect(() => {
    // Auto-refresh stub while the event is live (or whenever provisional rows exist).
    const shouldPoll =
      eventLive || initialResults.some((r) => r.status !== "official");
    if (!shouldPoll) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [eventLive, initialResults, refresh]);

  const counts = countsOf(results);
  const filtered =
    tab === "all" ? results : results.filter((r) => r.status === tab);

  return (
    <section style={{ marginTop: 32 }}>
      <div className="section-head">
        <div>
          <h2>Results</h2>
          <p>
            {results.length === 0
              ? "No performances linked to this event in the seed."
              : "Status badges show the live → unofficial → official cycle. Click a row for the dive page."}
          </p>
        </div>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          {refreshedAt && (
            <span className="source small">
              <Icon name="check-circle" /> Updated{" "}
              {new Date(refreshedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => void refresh()}
            disabled={polling}
            aria-busy={polling}
          >
            {polling ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div
        className="tabs"
        role="tablist"
        aria-label="Result status"
        style={{ marginBottom: 16 }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "is-on" : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="muted small" style={{ marginLeft: 6 }}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="banner banner--warn" role="status" style={{ marginBottom: 12 }}>
          Could not refresh results ({error}). Showing last known rows.
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="muted">Nothing to show for this filter.</p>
      ) : (
        <div className="rt-wrap">
          <table className="rt">
            <thead>
              <tr>
                <th className="l">Athlete</th>
                <th>Disc</th>
                <th>AP→RP</th>
                <th>Card</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const a = athletes[p.athleteSlug];
                if (!a) return null;
                return (
                  <tr key={p.id}>
                    <td className="n">
                      <CountryChip code={a.country} neutral={a.neutral} />
                      <Link href={`/dives/${p.diveId}`}>{a.name}</Link>
                      {p.nr && (
                        <span className="badge badge--record" title="National record">
                          NR
                        </span>
                      )}
                      {p.wr && (
                        <span className="badge badge--record" title="World record">
                          WR
                        </span>
                      )}
                    </td>
                    <td>{p.discipline}</td>
                    <td className="num">
                      {fmtValue(p.discipline, p.ap)} →{" "}
                      {p.card === "R" ? "DQ" : fmtValue(p.discipline, p.rp)}
                    </td>
                    <td>
                      <CardBadge card={p.card} />
                    </td>
                    <td>
                      <span className={statusClass(p.status, eventLive)}>
                        {statusLabel(p.status, eventLive)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="rt-meta">
            <span className="source">
              <Icon name="check-circle" /> Auto-refresh every 30s while live /
              provisional rows remain
            </span>
            <span>Official after jury confirmation</span>
          </div>
        </div>
      )}
    </section>
  );
}
