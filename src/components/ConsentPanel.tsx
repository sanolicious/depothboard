"use client";

import { useEffect, useState } from "react";
import type { ConsentPurpose, ConsentRecord, ConsentStatus } from "@/types/domain";
import { CONSENT_PURPOSE_COPY } from "@/lib/rights";
import { Icon } from "@/components/Icon";

const PURPOSES: ConsentPurpose[] = [
  "recording",
  "publication",
  "commercial",
  "coach",
];

const STORAGE_KEY = (slug: string) => `depthboard:consents:${slug}`;

type LocalMap = Partial<Record<ConsentPurpose, ConsentStatus>>;

function mergeStatus(
  seed: ConsentRecord[],
  local: LocalMap,
  purpose: ConsentPurpose,
): ConsentStatus {
  if (local[purpose]) return local[purpose]!;
  const row = seed.find((c) => c.purpose === purpose);
  return row?.status === "granted"
    ? "granted"
    : row?.status === "withdrawn"
      ? "withdrawn"
      : "missing";
}

export function ConsentPanel({
  athleteSlug,
  athleteName,
  minor,
  guardianConsentGranted,
  seedConsents,
}: {
  athleteSlug: string;
  athleteName: string;
  minor: boolean;
  guardianConsentGranted?: boolean;
  seedConsents: ConsentRecord[];
}) {
  const [local, setLocal] = useState<LocalMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [guardianOk, setGuardianOk] = useState(!!guardianConsentGranted);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(athleteSlug));
      if (raw) {
        const parsed = JSON.parse(raw) as {
          consents?: LocalMap;
          guardianConsentGranted?: boolean;
        };
        if (parsed.consents) setLocal(parsed.consents);
        if (typeof parsed.guardianConsentGranted === "boolean") {
          setGuardianOk(parsed.guardianConsentGranted);
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [athleteSlug]);

  function persist(next: LocalMap, nextGuardian: boolean) {
    setLocal(next);
    setGuardianOk(nextGuardian);
    localStorage.setItem(
      STORAGE_KEY(athleteSlug),
      JSON.stringify({
        consents: next,
        guardianConsentGranted: nextGuardian,
        updatedAt: new Date().toISOString(),
      }),
    );
    window.dispatchEvent(new Event("depthboard:consents"));
  }

  function toggle(purpose: ConsentPurpose) {
    const current = mergeStatus(seedConsents, local, purpose);
    const nextStatus: ConsentStatus =
      current === "granted" ? "withdrawn" : "granted";
    persist({ ...local, [purpose]: nextStatus }, guardianOk);
  }

  if (!hydrated) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <p className="muted small">Loading consents…</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="row row--between row--wrap" style={{ gap: 10 }}>
        <div>
          <h2 style={{ fontSize: "1.2rem" }}>Recording consents</h2>
          <p className="muted small" style={{ marginTop: 6 }}>
            {athleteName} · mock panel · saved in this browser (overrides seed)
          </p>
        </div>
        <span className="badge">MVP · no auth</span>
      </div>

      {minor && (
        <label
          className="row"
          style={{
            gap: 10,
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: "var(--surface-2)",
            border: "1px solid var(--line-soft)",
          }}
        >
          <input
            type="checkbox"
            checked={guardianOk}
            onChange={(e) => persist(local, e.target.checked)}
          />
          <span className="small">
            Guardian consent on file (required for juniors before any
            recording / publication)
          </span>
        </label>
      )}

      <ul className="stack" style={{ gap: 10, marginTop: 16, listStyle: "none", padding: 0 }}>
        {PURPOSES.map((purpose) => {
          const status = mergeStatus(seedConsents, local, purpose);
          const copy = CONSENT_PURPOSE_COPY[purpose];
          const granted = status === "granted";
          return (
            <li
              key={purpose}
              className="row row--between"
              style={{
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "var(--surface)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <strong style={{ fontSize: "0.95rem" }}>{copy.title}</strong>
                  <span
                    className={`badge ${granted ? "badge--accent" : ""}`}
                    style={{ textTransform: "capitalize" }}
                  >
                    {status}
                  </span>
                </div>
                <p className="caption" style={{ marginTop: 4 }}>
                  {copy.blurb}
                </p>
              </div>
              <button
                className={granted ? "btn btn--sm btn--ghost" : "btn btn--sm btn--primary"}
                type="button"
                onClick={() => toggle(purpose)}
              >
                <Icon name={granted ? "lock" : "check"} />
                {granted ? "Withdraw" : "Grant"}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="caption" style={{ marginTop: 14 }}>
        Shop and dive pages read seed consents server-side. Browser toggles here
        demonstrate the athlete UX; wire to an API after auth.
      </p>
    </div>
  );
}
