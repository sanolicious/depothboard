"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { fmtSlotRange } from "@/lib/coaching-marketplace-client";
import type { CoachAvailabilitySlot, CoachPackage } from "@/types/domain";

type Props = {
  coachSlug: string;
  packages: CoachPackage[];
  slots: CoachAvailabilitySlot[];
  signedIn: boolean;
  commissionPercent: number;
  loginNext: string;
};

export function BookSessionForm({
  coachSlug,
  packages,
  slots,
  signedIn,
  commissionPercent,
  loginNext,
}: Props) {
  const openSlots = useMemo(
    () => slots.filter((s) => s.status === "open"),
    [slots],
  );
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [slotId, setSlotId] = useState(openSlots[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  const selectedPkg = packages.find((p) => p.id === packageId);
  const selectedSlot = openSlots.find((s) => s.id === slotId);
  const diveyeFee = selectedPkg
    ? Math.round(((selectedPkg.priceEur * commissionPercent) / 100) * 100) /
      100
    : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!signedIn) {
      window.location.href = `/login?next=${encodeURIComponent(loginNext)}`;
      return;
    }
    if (!packageId || !slotId) {
      setError("Choose a package and an open slot");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/coaching/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachSlug,
          packageId,
          slotId,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        loginRequired?: boolean;
        booking?: { id: string };
        redirect?: string;
      };
      if (!res.ok || !data.ok) {
        if (data.loginRequired || res.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(loginNext)}`;
          return;
        }
        setError(data.error || "Booking failed");
        setBusy(false);
        return;
      }
      setDoneId(data.booking?.id ?? null);
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      setBusy(false);
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  if (doneId) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: "1.2rem" }}>Payment simulated</h2>
        <p className="muted small" style={{ marginTop: 8 }}>
          Booking <code>{doneId}</code> saved. Opening account…
        </p>
      </div>
    );
  }

  if (packages.length === 0 || openSlots.length === 0) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: "1.2rem" }}>Book a session</h2>
        <p className="muted small" style={{ marginTop: 8 }}>
          No open packages or slots right now. Check back after the next seed
          refresh.
        </p>
      </div>
    );
  }

  return (
    <form className="card" style={{ padding: 20 }} onSubmit={onSubmit}>
      <h2 style={{ fontSize: "1.2rem" }}>Book a session</h2>
      <p className="muted small" style={{ marginTop: 6 }}>
        Login required · simulated pay (like the shop when Stripe keys are
        unset). Diveye commission{" "}
        <strong>{commissionPercent}%</strong> shown at checkout.
      </p>

      <label className="small" style={{ display: "block", marginTop: 16 }}>
        Package
        <select
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 6 }}
          required
        >
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · €{p.priceEur} · {p.durationMin} min
            </option>
          ))}
        </select>
      </label>

      <label className="small" style={{ display: "block", marginTop: 14 }}>
        Availability (UTC)
        <select
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 6 }}
          required
        >
          {openSlots.map((s) => (
            <option key={s.id} value={s.id}>
              {fmtSlotRange(s.startsAt, s.endsAt)}
            </option>
          ))}
        </select>
      </label>

      <label className="small" style={{ display: "block", marginTop: 14 }}>
        Note to coach (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder="e.g. review dive-0 CWT turn"
          style={{ display: "block", width: "100%", marginTop: 6 }}
        />
      </label>

      {selectedPkg && selectedSlot && (
        <p className="caption" style={{ marginTop: 12 }}>
          Total €{selectedPkg.priceEur.toFixed(2)} · Diveye €
          {diveyeFee.toFixed(2)} ({commissionPercent}%) · coach payout €
          {(selectedPkg.priceEur - diveyeFee).toFixed(2)}
        </p>
      )}

      {error && (
        <p className="small" role="alert" style={{ marginTop: 10, color: "#f88" }}>
          {error}
        </p>
      )}

      <div className="row row--wrap" style={{ gap: 10, marginTop: 16 }}>
        {signedIn ? (
          <button
            className="btn btn--primary"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Booking…"
              : `Pay (simulated) · €${(selectedPkg?.priceEur ?? 0).toFixed(2)}`}
          </button>
        ) : (
          <Link
            className="btn btn--primary"
            href={`/login?next=${encodeURIComponent(loginNext)}`}
          >
            Sign in to book
          </Link>
        )}
      </div>
    </form>
  );
}
