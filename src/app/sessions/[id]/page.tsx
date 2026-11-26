import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { fmtDate } from "@/lib/format";
import { getRepository } from "@/lib/repository";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const session = getRepository().getFieldSession(id);
  return {
    title: session ? `Session · ${session.label}` : "Session",
    robots: { index: false, follow: false },
    alternates: { canonical: `/sessions/${id}` },
  };
}

export default async function SessionDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const repo = getRepository();
  const session = repo.getFieldSession(id);
  if (!session) notFound();

  const devices = session.deviceIds
    .map((did) => repo.getDevice(did))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const assignments = repo.listDiveAssignments({ fieldSessionId: id });
  const telemetry = repo.listTelemetrySamples({ fieldSessionId: id });
  const consents = (repo.getDb().consents ?? []).filter(
    (c) =>
      c.fieldSessionId === id ||
      (session.consentIds ?? []).includes(c.id),
  );
  const event = session.eventId
    ? repo.getEventById(session.eventId)
    : undefined;

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <Link href="/devices">Devices</Link>
        <Icon name="chev-r" />
        <span aria-current="page">{session.label}</span>
      </nav>

      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>{session.label}</h1>
          <p>
            Field session stub · {session.kind} · {session.status}. Read-only
            hook for later field app — no live control UI.
          </p>
        </div>
      </div>

      <dl
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <dt className="caption">Org</dt>
          <dd>{session.ownerOrg}</dd>
        </div>
        <div>
          <dt className="caption">Venue</dt>
          <dd>{session.venue ?? "—"}</dd>
        </div>
        <div>
          <dt className="caption">Started</dt>
          <dd>{fmtDate(session.startedAt.slice(0, 10))}</dd>
        </div>
        <div>
          <dt className="caption">Ended</dt>
          <dd>
            {session.endedAt
              ? fmtDate(session.endedAt.slice(0, 10))
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="caption">Event</dt>
          <dd>
            {event ? (
              <Link href={`/events/${event.slug}`}>{event.shortName}</Link>
            ) : (
              session.eventId ?? "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="caption">API</dt>
          <dd>
            <code>/api/sessions/{session.id}</code>
          </dd>
        </div>
      </dl>

      {session.notes ? (
        <p className="muted" style={{ marginBottom: 24 }}>
          {session.notes}
        </p>
      ) : null}

      <h2 style={{ marginBottom: 12 }}>Devices</h2>
      <ul className="card" style={{ marginBottom: 28, listStyle: "none", padding: 16 }}>
        {devices.map((d) => (
          <li
            key={d.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 0",
              borderBottom: "1px solid var(--line-soft)",
            }}
          >
            <span>
              <strong>{d.serial}</strong> · {d.tier}
              {d.label ? ` · ${d.label}` : ""}
            </span>
            <span className="muted small">
              fw {d.firmware}
              {d.battery !== undefined ? ` · ${d.battery}%` : ""}
            </span>
          </li>
        ))}
        {!devices.length ? (
          <li className="muted">No devices linked.</li>
        ) : null}
      </ul>

      <h2 style={{ marginBottom: 12 }}>Dive assignments</h2>
      <div className="table-scroll card card--flush" style={{ marginBottom: 28 }}>
        <table className="results-table">
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Dive</th>
              <th>Device</th>
              <th>Role</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const athlete = repo.getAthleteBySlug(a.athleteSlug);
              const device = repo.getDevice(a.deviceId);
              return (
                <tr key={a.id}>
                  <td>
                    {athlete ? (
                      <Link href={`/athletes/${athlete.slug}`}>
                        {athlete.name}
                      </Link>
                    ) : (
                      a.athleteSlug
                    )}
                  </td>
                  <td>
                    {a.diveId ? (
                      <Link href={`/dives/${a.diveId}`}>{a.diveId}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{device?.serial ?? a.deviceId}</td>
                  <td>{a.role ?? "primary"}</td>
                  <td>{fmtDate(a.assignedAt.slice(0, 10))}</td>
                </tr>
              );
            })}
            {!assignments.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  No assignments.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginBottom: 12 }}>Consents linked</h2>
      <ul className="card" style={{ marginBottom: 28, listStyle: "none", padding: 16 }}>
        {consents.map((c) => (
          <li key={c.id} style={{ padding: "6px 0" }}>
            <code>{c.id}</code> · {c.purpose} · {c.status} · {c.athleteSlug}
          </li>
        ))}
        {!consents.length ? (
          <li className="muted">No consents linked to this session.</li>
        ) : null}
      </ul>

      <h2 style={{ marginBottom: 12 }}>Telemetry samples (hook)</h2>
      <div className="table-scroll card card--flush">
        <table className="results-table">
          <thead>
            <tr>
              <th>atSec</th>
              <th>Channel</th>
              <th className="r">Value</th>
              <th>Dive</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            {telemetry.map((t) => (
              <tr key={t.id}>
                <td>{t.atSec}</td>
                <td>{t.channel}</td>
                <td className="r">
                  {t.value} {t.unit}
                </td>
                <td>{t.diveId ?? "—"}</td>
                <td>{t.deviceId}</td>
              </tr>
            ))}
            {!telemetry.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  No samples seeded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
