"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ClaimVerifyMethod, SessionUser } from "@/types/domain";

type AthleteHit = {
  slug: string;
  name: string;
  country: string;
  countryName: string;
  claimed: boolean;
  minor: boolean;
  hint: string;
};

const STEPS = ["Account", "Find profile", "Verify", "Done"] as const;

const VERIFY_OPTIONS: Array<{
  id: ClaimVerifyMethod;
  title: string;
  blurb: string;
}> = [
  {
    id: "email_match",
    title: "Email match",
    blurb: "We match your account email to federation contact records when available.",
  },
  {
    id: "event_proof",
    title: "Event proof",
    blurb: "Name two events you competed in — steward checks start lists.",
  },
  {
    id: "coach_confirm",
    title: "Coach or judge confirmation",
    blurb: "Ask someone who knows you to confirm by email (manual follow-up).",
  },
  {
    id: "id_document",
    title: "ID document",
    blurb: "Last resort. Encrypted, deleted within 30 days of decision (not uploaded in this MVP).",
  },
];

export function ClaimWizard({
  inbox,
  session,
  initialSlug,
  athleteCatalog,
}: {
  inbox: string;
  session: SessionUser | null;
  initialSlug?: string;
  athleteCatalog: AthleteHit[];
}) {
  const initialStep = session ? (initialSlug ? 2 : 1) : 0;
  const [step, setStep] = useState(initialStep);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AthleteHit | null>(() => {
    if (!initialSlug) return null;
    return athleteCatalog.find((a) => a.slug === initialSlug) ?? null;
  });
  const [method, setMethod] = useState<ClaimVerifyMethod>("event_proof");
  const [eventA, setEventA] = useState("");
  const [eventB, setEventB] = useState("");
  const [federationId, setFederationId] = useState("");
  const [guardian, setGuardian] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [claimId, setClaimId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return athleteCatalog.slice(0, 8);
    }
    return athleteCatalog
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.slug.includes(q) ||
          a.country.toLowerCase().includes(q) ||
          a.countryName.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [athleteCatalog, query]);

  async function submitClaim() {
    if (!session || !selected) return;
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteName: selected.name,
          athleteSlug: selected.slug,
          email: session.email,
          federationId: federationId || undefined,
          guardian: guardian || selected.minor,
          verifyMethod: method,
          eventProofIds:
            method === "event_proof"
              ? [eventA, eventB].map((s) => s.trim()).filter(Boolean)
              : undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        mailto?: string;
        claim?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Claim failed");
      }
      setClaimId(json.claim?.id ?? null);
      setStatus("done");
      setStep(3);
      setMessage(
        `Claim submitted · Under review. We logged it and opened mail to ${inbox}.`,
      );
      if (json.mailto) {
        window.location.href = json.mailto;
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Could not submit claim");
    }
  }

  return (
    <div className="card" style={{ padding: 24, maxWidth: 720 }}>
      <div className="row row--between row--wrap" style={{ gap: 12 }}>
        <h2 style={{ fontSize: "1.25rem" }}>Claim your profile</h2>
        <span className="badge">
          Step {Math.min(step, 3) + 1} of 4
        </span>
      </div>

      <ol
        className="row row--wrap"
        style={{
          gap: 8,
          marginTop: 16,
          listStyle: "none",
          padding: 0,
          fontSize: "0.85rem",
        }}
      >
        {STEPS.map((label, i) => (
          <li
            key={label}
            className="badge"
            style={{
              opacity: i <= step ? 1 : 0.45,
              background:
                i < step
                  ? "var(--accent-soft, var(--surface-2))"
                  : i === step
                    ? "var(--surface-2)"
                    : undefined,
            }}
          >
            {i < step ? "✓ " : `${i + 1}. `}
            {label}
          </li>
        ))}
      </ol>

      <div
        style={{
          marginTop: 10,
          height: 6,
          borderRadius: 99,
          background: "var(--surface-2)",
          overflow: "hidden",
        }}
        aria-hidden
      >
        <div
          style={{
            width: `${((Math.min(step, 3) + 1) / 4) * 100}%`,
            height: "100%",
            background: "var(--accent, #6ec8ff)",
            transition: "width 0.25s ease",
          }}
        />
      </div>

      {step === 0 && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: "1.05rem" }}>1 · Account</h3>
          <p className="muted small" style={{ marginTop: 8 }}>
            Sign in first. Claims are tied to your session email and go to{" "}
            {inbox} for manual review.
          </p>
          <Link
            className="btn btn--primary"
            href={`/login?next=${encodeURIComponent(
              initialSlug ? `/claim?slug=${initialSlug}` : "/claim",
            )}`}
            style={{ marginTop: 16 }}
          >
            <Icon name="user" /> Sign in to continue
          </Link>
        </div>
      )}

      {step === 1 && session && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: "1.05rem" }}>2 · Find your profile</h3>
          <p className="muted small" style={{ marginTop: 8 }}>
            Signed in as <strong>{session.email}</strong>. Search by name or
            country.
          </p>
          <label className="stack" style={{ gap: 6, marginTop: 14 }}>
            <span className="small">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Surname Name…"
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
                color: "var(--text)",
                padding: "0 12px",
              }}
            />
          </label>
          <ul
            className="stack"
            style={{ gap: 8, marginTop: 14, listStyle: "none", padding: 0 }}
          >
            {hits.map((a) => (
              <li
                key={a.slug}
                className="row row--between"
                style={{
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background:
                    selected?.slug === a.slug
                      ? "var(--surface-2)"
                      : "var(--surface)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: "0.95rem" }}>{a.name}</strong>
                  <p className="caption" style={{ marginTop: 4 }}>
                    {a.country} · {a.hint}
                    {a.claimed ? " · already claimed" : ""}
                    {a.minor ? " · minor (guardian)" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  disabled={a.claimed && a.slug !== session.athleteSlug}
                  onClick={() => {
                    setSelected(a);
                    setGuardian(a.minor);
                    setStep(2);
                  }}
                >
                  This is me
                </button>
              </li>
            ))}
          </ul>
          {hits.length === 0 && (
            <p className="muted small" style={{ marginTop: 12 }}>
              No matches. Try another spelling or{" "}
              <Link href="/athletes">browse athletes</Link>.
            </p>
          )}
        </div>
      )}

      {step === 2 && session && selected && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: "1.05rem" }}>3 · Verify</h3>
          <p className="muted small" style={{ marginTop: 8 }}>
            Claiming <strong>{selected.name}</strong>. Estimated review: within
            2 working days.
          </p>
          <fieldset style={{ border: 0, marginTop: 14, padding: 0 }}>
            <legend className="small">Verification method</legend>
            <ul
              className="stack"
              style={{ gap: 8, marginTop: 10, listStyle: "none", padding: 0 }}
            >
              {VERIFY_OPTIONS.map((opt) => (
                <li key={opt.id}>
                  <label
                    className="row"
                    style={{
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--line-soft)",
                      background: "var(--surface)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="verify"
                      checked={method === opt.id}
                      onChange={() => setMethod(opt.id)}
                    />
                    <span>
                      <strong style={{ fontSize: "0.95rem" }}>{opt.title}</strong>
                      <span className="caption" style={{ display: "block", marginTop: 4 }}>
                        {opt.blurb}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          {method === "event_proof" && (
            <div className="grid grid-2" style={{ gap: 12, marginTop: 14 }}>
              <label className="stack" style={{ gap: 6 }}>
                <span className="small">Event 1</span>
                <input
                  value={eventA}
                  onChange={(e) => setEventA(e.target.value)}
                  placeholder="e.g. AIDA Depth Worlds 2025"
                  style={{
                    minHeight: 44,
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    padding: "0 12px",
                  }}
                />
              </label>
              <label className="stack" style={{ gap: 6 }}>
                <span className="small">Event 2</span>
                <input
                  value={eventB}
                  onChange={(e) => setEventB(e.target.value)}
                  placeholder="e.g. CMAS Pool 2024"
                  style={{
                    minHeight: 44,
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    padding: "0 12px",
                  }}
                />
              </label>
            </div>
          )}

          <label className="stack" style={{ gap: 6, marginTop: 14 }}>
            <span className="small">Federation ID (optional)</span>
            <input
              value={federationId}
              onChange={(e) => setFederationId(e.target.value)}
              placeholder="AIDA / CMAS athlete id"
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
                color: "var(--text)",
                padding: "0 12px",
              }}
            />
          </label>

          <label className="row" style={{ gap: 10, marginTop: 14 }}>
            <input
              type="checkbox"
              checked={guardian}
              onChange={(e) => setGuardian(e.target.checked)}
            />
            <span className="small">
              I am a guardian claiming for a minor (guardian consent required)
            </span>
          </label>

          <div className="row row--wrap" style={{ gap: 10, marginTop: 18 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={status === "sending"}
              onClick={submitClaim}
            >
              <Icon name="mail" />
              {status === "sending" ? "Submitting…" : "Submit claim"}
            </button>
          </div>
          {status === "error" && message && (
            <p className="caption" style={{ marginTop: 12, color: "var(--danger, #e08080)" }}>
              {message}
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: "1.05rem" }}>4 · Done</h3>
          <p className="muted small" style={{ marginTop: 8 }}>
            {message ||
              "Claim submitted · Under review · We emailed the steward inbox."}
          </p>
          {claimId && (
            <p className="small" style={{ marginTop: 10 }}>
              Claim ID: <code>{claimId}</code>
            </p>
          )}
          <p className="caption" style={{ marginTop: 12 }}>
            Status in Account: pending → approved / needs info / rejected.
            After approval, your athlete profile appears under Account and
            consent edits unlock.
          </p>
          <div className="row row--wrap" style={{ gap: 10, marginTop: 18 }}>
            <Link className="btn btn--primary" href="/account">
              Open account
            </Link>
            <Link className="btn btn--ghost" href="/athletes">
              Browse athletes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
