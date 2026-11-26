"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  clearSyncedOps,
  enqueueFieldOp,
  newClientId,
  parseAthleteQr,
  readFieldBuffer,
  readLocalSession,
  writeLocalSession,
  type FieldBufferOp,
  type FieldLocalSession,
} from "@/lib/field-buffer";
import type { Device, FieldSession } from "@/types/domain";

export type FieldAthleteRow = {
  slug: string;
  name: string;
  country: string;
  minor?: boolean;
  recordingConsent: boolean;
};

type SyncResultItem = {
  opId: string;
  ok: boolean;
  error?: string;
  sessionId?: string;
  assignmentId?: string;
  diveId?: string;
  consentOk?: boolean;
};

type Props = {
  operatorName: string;
  operatorRole: string;
  devices: Device[];
  seedSessions: FieldSession[];
  athletes: FieldAthleteRow[];
};

export function FieldApp({
  operatorName,
  operatorRole,
  devices,
  seedSessions,
  athletes,
}: Props) {
  const [buffer, setBuffer] = useState<FieldBufferOp[]>([]);
  const [localSession, setLocalSession] = useState<FieldLocalSession | null>(
    null,
  );
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [kind, setKind] = useState<"competition" | "training" | "demo">(
    "training",
  );
  const [label, setLabel] = useState("Field training");
  const [venue, setVenue] = useState("");
  const [athleteQ, setAthleteQ] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [qrRaw, setQrRaw] = useState("");
  const [diveId, setDiveId] = useState("");
  const [discipline, setDiscipline] = useState("DYN");
  const [ap, setAp] = useState("");
  const [withPerfStub, setWithPerfStub] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"ok" | "warn" | "err">("ok");
  const [online, setOnline] = useState(true);

  const refresh = useCallback(() => {
    setBuffer(readFieldBuffer());
    setLocalSession(readLocalSession());
  }, []);

  useEffect(() => {
    refresh();
    const onBuf = () => refresh();
    window.addEventListener("depthboard:field-buffer", onBuf);
    window.addEventListener("depthboard:field-session", onBuf);
    window.addEventListener("storage", onBuf);
    const onOnline = () => setOnline(navigator.onLine);
    setOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    return () => {
      window.removeEventListener("depthboard:field-buffer", onBuf);
      window.removeEventListener("depthboard:field-session", onBuf);
      window.removeEventListener("storage", onBuf);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    };
  }, [refresh]);

  const activeSeed = useMemo(
    () => seedSessions.find((s) => s.status === "active"),
    [seedSessions],
  );

  const sessionActive =
    localSession?.status === "active" ||
    (!localSession && !!activeSeed && deviceId && activeSeed.deviceIds.includes(deviceId));

  const effectiveSessionId =
    localSession?.id ||
    (sessionActive && activeSeed ? activeSeed.id : undefined);

  const filteredAthletes = useMemo(() => {
    const q = athleteQ.trim().toLowerCase();
    if (!q) return athletes.slice(0, 24);
    return athletes
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.slug.includes(q) ||
          a.country.toLowerCase().includes(q),
      )
      .slice(0, 24);
  }, [athleteQ, athletes]);

  const selected = athletes.find((a) => a.slug === selectedSlug) ?? null;

  function flash(text: string, tone: "ok" | "warn" | "err" = "ok") {
    setMessage(text);
    setMessageTone(tone);
  }

  function openSession() {
    if (!deviceId) {
      flash("Pick a device first", "err");
      return;
    }
    if (localSession?.status === "active") {
      flash("Session already open on this device", "warn");
      return;
    }
    const sessionId = newClientId("fs-local");
    const at = new Date().toISOString();
    const session: FieldLocalSession = {
      id: sessionId,
      deviceId,
      label: label.trim() || "Field session",
      kind,
      venue: venue.trim() || undefined,
      startedAt: at,
      status: "active",
    };
    const op: FieldBufferOp = {
      id: newClientId("op-open"),
      type: "open_session",
      at,
      sessionId,
      deviceId,
      kind,
      label: session.label,
      venue: session.venue,
    };
    enqueueFieldOp(op);
    writeLocalSession(session);
    refresh();
    flash(
      online
        ? "Session opened locally — tap Sync to persist"
        : "Offline — session buffered for sync",
      online ? "ok" : "warn",
    );
  }

  function closeSession() {
    const sid = effectiveSessionId;
    if (!sid) {
      flash("No active session", "err");
      return;
    }
    const at = new Date().toISOString();
    enqueueFieldOp({
      id: newClientId("op-close"),
      type: "close_session",
      at,
      sessionId: sid,
    });
    if (localSession) {
      writeLocalSession({ ...localSession, status: "completed" });
    } else {
      writeLocalSession(null);
    }
    refresh();
    flash("Close queued — Sync to complete on server", "ok");
  }

  function applyQr() {
    const slug = parseAthleteQr(qrRaw);
    if (!slug) {
      flash("Could not parse QR / badge text", "err");
      return;
    }
    const hit = athletes.find((a) => a.slug === slug);
    if (!hit) {
      flash(`No athlete for slug “${slug}”`, "err");
      return;
    }
    setSelectedSlug(hit.slug);
    setAthleteQ(hit.name);
    flash(`Selected ${hit.name}`, "ok");
  }

  function assignDive() {
    const sid = effectiveSessionId;
    if (!sid) {
      flash("Open a field session first", "err");
      return;
    }
    if (!selectedSlug) {
      flash("Select an athlete (list or QR)", "err");
      return;
    }
    if (!selected?.recordingConsent) {
      flash(
        "Blocked locally: missing recording consent — sync will also reject",
        "err",
      );
      return;
    }
    const at = new Date().toISOString();
    const apNum = ap.trim() ? Number(ap) : undefined;
    enqueueFieldOp({
      id: newClientId("op-assign"),
      type: "assign",
      at,
      sessionId: sid,
      deviceId: localSession?.deviceId || deviceId,
      athleteSlug: selectedSlug,
      diveId: diveId.trim() || undefined,
      qrRaw: qrRaw.trim() || undefined,
      role: "primary",
      performanceStub: withPerfStub
        ? {
            discipline: discipline.trim() || "DYN",
            ap: Number.isFinite(apNum) ? apNum : undefined,
            federation: "AIDA",
          }
        : undefined,
    });
    refresh();
    setDiveId("");
    setAp("");
    flash(
      `Assignment for ${selected?.name ?? selectedSlug} buffered`,
      "ok",
    );
  }

  async function syncNow() {
    const ops = readFieldBuffer();
    if (!ops.length) {
      flash("Buffer empty — nothing to sync", "warn");
      return;
    }
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/field/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        results?: SyncResultItem[];
        aliases?: Record<string, string>;
      };
      if (!res.ok) {
        throw new Error(json.error || `Sync failed (${res.status})`);
      }
      const results = json.results ?? [];
      const syncedOk = results.filter((r) => r.ok).map((r) => r.opId);
      clearSyncedOps(syncedOk);
      const aliases = json.aliases ?? {};
      const loc = readLocalSession();
      if (loc && aliases[loc.id]) {
        writeLocalSession({ ...loc, id: aliases[loc.id]! });
      }
      // Drop completed local session after successful close.
      const closedOk = results.some(
        (r) =>
          r.ok &&
          ops.find((o) => o.id === r.opId)?.type === "close_session",
      );
      if (closedOk) writeLocalSession(null);

      refresh();
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        flash(
          `Synced ${syncedOk.length}; ${failed.length} failed (${failed[0]?.error})`,
          "warn",
        );
      } else {
        flash(
          `Synced ${syncedOk.length} op${syncedOk.length === 1 ? "" : "s"}`,
          "ok",
        );
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : "Sync failed", "err");
    } finally {
      setSyncing(false);
    }
  }

  const device = devices.find((d) => d.id === deviceId);

  return (
    <div className="field-app">
      <header className="field-app__bar">
        <div>
          <p className="field-app__eyebrow">Field operator</p>
          <h1 className="field-app__title">Dive assignment</h1>
          <p className="field-app__meta">
            {operatorName} · {operatorRole}
            <span
              className={
                online ? "field-app__pill is-on" : "field-app__pill is-off"
              }
            >
              {online ? "Online" : "Offline"}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary field-app__sync"
          onClick={syncNow}
          disabled={syncing || buffer.length === 0}
        >
          {syncing ? "Syncing…" : `Sync (${buffer.length})`}
        </button>
      </header>

      {message ? (
        <p
          className={`banner field-app__msg ${
            messageTone === "err"
              ? "banner--danger"
              : messageTone === "warn"
                ? "banner--warn"
                : ""
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <section className="field-app__card" aria-labelledby="field-session-h">
        <h2 id="field-session-h">Session</h2>
        <div className="field">
          <label htmlFor="field-device">Device</label>
          <select
            id="field-device"
            className="input"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={!!localSession && localSession.status === "active"}
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label || d.serial} · {d.tier} ({d.status ?? "—"})
              </option>
            ))}
          </select>
          {device ? (
            <span className="hint">
              {device.serial} · fw {device.firmware}
              {typeof device.battery === "number"
                ? ` · ${device.battery}%`
                : ""}
            </span>
          ) : null}
        </div>

        <div className="field-app__row">
          <div className="field">
            <label htmlFor="field-kind">Kind</label>
            <select
              id="field-kind"
              className="input"
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as "competition" | "training" | "demo")
              }
            >
              <option value="training">Training</option>
              <option value="competition">Competition</option>
              <option value="demo">Demo</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="field-label">Label</label>
            <input
              id="field-label"
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="field-venue">Venue</label>
          <input
            id="field-venue"
            className="input"
            placeholder="Pool / line / site"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </div>

        <div className="field-app__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={openSession}
            disabled={!!localSession && localSession.status === "active"}
          >
            Open session
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={closeSession}
            disabled={!effectiveSessionId}
          >
            Close session
          </button>
        </div>

        {effectiveSessionId ? (
          <p className="field-app__session-status">
            Active: <code>{effectiveSessionId}</code>
            {localSession?.label ? ` · ${localSession.label}` : null}
          </p>
        ) : (
          <p className="muted small">
            No local session. Seed active:{" "}
            {activeSeed ? (
              <Link href={`/sessions/${activeSeed.id}`}>{activeSeed.label}</Link>
            ) : (
              "none"
            )}
            .
          </p>
        )}
      </section>

      <section className="field-app__card" aria-labelledby="field-athletes-h">
        <h2 id="field-athletes-h">Athletes</h2>
        <div className="field">
          <label htmlFor="field-qr">QR / badge (text stub)</label>
          <div className="field-app__qr">
            <input
              id="field-qr"
              className="input"
              placeholder="depthboard:athlete:vitomir-maricic"
              value={qrRaw}
              onChange={(e) => setQrRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyQr();
                }
              }}
            />
            <button type="button" className="btn" onClick={applyQr}>
              Apply
            </button>
          </div>
          <span className="hint">
            Camera QR later — paste slug or <code>depthboard:athlete:…</code>
          </span>
        </div>

        <div className="field">
          <label htmlFor="field-ath-q">Search</label>
          <input
            id="field-ath-q"
            className="input"
            placeholder="Name, slug, country"
            value={athleteQ}
            onChange={(e) => setAthleteQ(e.target.value)}
          />
        </div>

        <ul className="field-app__athletes">
          {filteredAthletes.map((a) => {
            const on = a.slug === selectedSlug;
            return (
              <li key={a.slug}>
                <button
                  type="button"
                  className={
                    on
                      ? "field-app__athlete is-selected"
                      : "field-app__athlete"
                  }
                  onClick={() => setSelectedSlug(a.slug)}
                >
                  <span className="field-app__athlete-name">
                    {a.name}
                    {a.minor ? (
                      <span className="badge" style={{ marginLeft: 8 }}>
                        Junior
                      </span>
                    ) : null}
                  </span>
                  <span className="field-app__athlete-meta">
                    {a.country} ·{" "}
                    {a.recordingConsent ? (
                      <span className="badge badge--success">Recording OK</span>
                    ) : (
                      <span className="badge badge--warn">No recording</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {!filteredAthletes.length ? (
            <li className="muted small">No athletes match.</li>
          ) : null}
        </ul>
      </section>

      <section className="field-app__card" aria-labelledby="field-assign-h">
        <h2 id="field-assign-h">Assign dive</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>
          {selected
            ? `Selected: ${selected.name}`
            : "Select an athlete above first."}
        </p>
        <div className="field-app__row">
          <div className="field">
            <label htmlFor="field-disc">Discipline</label>
            <input
              id="field-disc"
              className="input"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="field-ap">AP (optional)</label>
            <input
              id="field-ap"
              className="input"
              inputMode="decimal"
              placeholder="e.g. 150"
              value={ap}
              onChange={(e) => setAp(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="field-dive-id">Dive id (optional)</label>
          <input
            id="field-dive-id"
            className="input"
            placeholder="Auto-generated if empty"
            value={diveId}
            onChange={(e) => setDiveId(e.target.value)}
          />
        </div>
        <label className="check" style={{ marginTop: 8, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={withPerfStub}
            onChange={(e) => setWithPerfStub(e.target.checked)}
          />
          <span>Create provisional performance stub on sync</span>
        </label>
        <button
          type="button"
          className="btn btn--primary"
          style={{ width: "100%" }}
          onClick={assignDive}
          disabled={!selectedSlug || !effectiveSessionId}
        >
          Assign to person
        </button>
      </section>

      <section className="field-app__card" aria-labelledby="field-buf-h">
        <h2 id="field-buf-h">
          Offline buffer <span className="badge">{buffer.length}</span>
        </h2>
        {buffer.length === 0 ? (
          <p className="muted small">Empty — ops land in localStorage until Sync.</p>
        ) : (
          <ol className="field-app__buffer">
            {buffer.map((op) => (
              <li key={op.id}>
                <strong>{op.type}</strong>
                <span className="muted small">
                  {" "}
                  · {op.at.slice(11, 19)}
                  {op.athleteSlug ? ` · ${op.athleteSlug}` : ""}
                  {op.sessionId ? ` · ${op.sessionId}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="caption" style={{ marginTop: 12 }}>
          <Icon name="info" /> Persist via{" "}
          <code>POST /api/field/sync</code> → DiveAssignment (+ optional
          performance). Consents enforced server-side.
        </p>
      </section>
    </div>
  );
}
