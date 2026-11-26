"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

export function ClaimForm({ inbox }: { inbox: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const athleteName = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const federationId = String(data.get("fedId") ?? "").trim();
    const guardian = data.get("guardian") === "on";

    if (!athleteName || !email) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteName,
          email,
          federationId: federationId || undefined,
          guardian,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        mailto?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Request failed");
      }
      setStatus("done");
      setMessage(
        `Logged locally. Opening mail to ${inbox} for steward review…`,
      );
      if (json.mailto) {
        window.location.href = json.mailto;
      }
      form.reset();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Could not log claim");
      const subject = encodeURIComponent(`Profile claim: ${athleteName}`);
      const body = encodeURIComponent(
        [
          `Athlete: ${athleteName}`,
          `Email: ${email}`,
          federationId ? `Federation ID: ${federationId}` : null,
          `Guardian claim: ${guardian ? "yes" : "no"}`,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      window.location.href = `mailto:${inbox}?subject=${subject}&body=${body}`;
    }
  }

  return (
    <form
      className="card"
      style={{ padding: 24, maxWidth: 560 }}
      onSubmit={onSubmit}
    >
      <label className="stack" style={{ gap: 6, marginBottom: 14 }}>
        <span className="small">Athlete name</span>
        <input
          name="name"
          required
          placeholder="As on federation start lists"
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
      <label className="stack" style={{ gap: 6, marginBottom: 14 }}>
        <span className="small">Email for verification</span>
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
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
      <label className="stack" style={{ gap: 6, marginBottom: 14 }}>
        <span className="small">Federation ID (optional)</span>
        <input
          name="fedId"
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
      <label className="row" style={{ gap: 10, marginBottom: 18 }}>
        <input type="checkbox" name="guardian" />
        <span className="small">
          I am a guardian claiming for a minor (guardian consent required)
        </span>
      </label>
      <button
        className="btn btn--primary"
        type="submit"
        disabled={status === "sending"}
      >
        <Icon name="mail" />
        {status === "sending" ? "Submitting…" : `Submit claim → ${inbox}`}
      </button>
      {message && (
        <p
          className="caption"
          style={{
            marginTop: 12,
            color: status === "error" ? "var(--danger, #e08080)" : undefined,
          }}
        >
          {message}
        </p>
      )}
      <p className="caption" style={{ marginTop: 12 }}>
        MVP logs the request to <code>data/claim-requests.json</code> and opens a
        mailto to the steward inbox. No OAuth.
      </p>
    </form>
  );
}
