"use client";

import { useState } from "react";

export function MediaPackQuoteForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [useCase, setUseCase] = useState("broadcast");
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(
      `Media pack quote — ${org || name || "Depthboard"}`,
    );
    const body = encodeURIComponent(
      [
        `Name: ${name}`,
        `Email: ${email}`,
        `Organisation: ${org}`,
        `Use case: ${useCase}`,
        "",
        notes,
        "",
        "(Submitted from /shop#media-pack — commercial quote funnel)",
      ].join("\n"),
    );
    window.location.href = `mailto:quotes@depthboard.com?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <form
      id="media-pack"
      className="card"
      style={{ padding: 20, marginTop: 28 }}
      onSubmit={submit}
    >
      <h2 style={{ fontSize: "1.25rem" }}>Media pack / commercial quote</h2>
      <p className="muted small" style={{ marginTop: 8 }}>
        For broadcast, sponsors and B2B packs on Diveye-owned (AIDA) events.
        CMAS remains embed-only. Orientative list price €129+ — final quote by
        email.
      </p>
      <div
        className="grid grid-2"
        style={{ gap: 12, marginTop: 16 }}
      >
        <label className="small">
          Name
          <input
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
        <label className="small">
          Work email
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
        <label className="small">
          Organisation
          <input
            className="input"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </label>
        <label className="small">
          Use case
          <select
            className="select"
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          >
            <option value="broadcast">Broadcast / TV</option>
            <option value="sponsor">Sponsor / ads</option>
            <option value="event-pack">Event media pack</option>
            <option value="other">Other commercial</option>
          </select>
        </label>
      </div>
      <label className="small" style={{ display: "block", marginTop: 12 }}>
        Notes
        <textarea
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 4 }}
          placeholder="Event, athlete, territories, deadlines…"
        />
      </label>
      <button className="btn btn--primary" type="submit" style={{ marginTop: 16 }}>
        Open quote email
      </button>
      {sent && (
        <p className="caption" style={{ marginTop: 10 }}>
          Mailto opened — if nothing appeared, write to quotes@depthboard.com.
        </p>
      )}
    </form>
  );
}
