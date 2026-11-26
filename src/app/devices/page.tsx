import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { fmtDate } from "@/lib/format";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = {
  title: "Devices (admin demo)",
  description:
    "Read-only Diveye fleet hooks — Compact / Connected / Pro model stubs for later field app and drones.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/devices" },
};

function statusClass(status?: string) {
  switch (status) {
    case "online":
    case "active":
      return "badge badge--success";
    case "maintenance":
      return "badge badge--warn";
    case "retired":
    case "cancelled":
      return "badge";
    default:
      return "badge";
  }
}

export default function DevicesPage() {
  const repo = getRepository();
  const devices = repo.listDevices();
  const sessions = repo.listFieldSessions();

  return (
    <div className="container section">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <Icon name="chev-r" />
        <span aria-current="page">Devices</span>
      </nav>
      <div className="section-head" style={{ marginTop: 16 }}>
        <div>
          <h1>Devices</h1>
          <p>
            Admin demo — read-only fleet hooks (serial, tier, firmware,
            lastSeen). No Compact / Connected / Pro hardware UI — stubs for
            later field app and drone plug-in.
          </p>
        </div>
      </div>

      <p className="caption" style={{ marginBottom: 20 }}>
        API: <code>GET /api/devices</code> ·{" "}
        <code>GET /api/sessions</code> · sessions link consents via{" "}
        <code>fieldSessionId</code>.
      </p>

      <div className="table-scroll card card--flush" style={{ marginBottom: 32 }}>
        <table className="results-table">
          <thead>
            <tr>
              <th>Serial</th>
              <th>Tier</th>
              <th>Org</th>
              <th>Firmware</th>
              <th>Last seen</th>
              <th className="r">Battery</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.serial}</strong>
                  {d.label ? (
                    <small style={{ display: "block", color: "var(--text-muted)" }}>
                      {d.label}
                    </small>
                  ) : null}
                </td>
                <td>{d.tier}</td>
                <td>{d.ownerOrg}</td>
                <td>
                  <code>{d.firmware}</code>
                </td>
                <td>{fmtDate(d.lastSeen.slice(0, 10))}</td>
                <td className="r">
                  {d.battery !== undefined ? `${d.battery}%` : "—"}
                </td>
                <td>
                  <span className={statusClass(d.status)}>
                    {d.status ?? "offline"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-head">
        <div>
          <h2>Field sessions</h2>
          <p>Competition / training / demo capture sessions linked to devices.</p>
        </div>
      </div>

      <div className="table-scroll card card--flush">
        <table className="results-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Kind</th>
              <th>Org</th>
              <th>Devices</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.label}</strong>
                  {s.venue ? (
                    <small style={{ display: "block", color: "var(--text-muted)" }}>
                      {s.venue}
                    </small>
                  ) : null}
                </td>
                <td>{s.kind}</td>
                <td>{s.ownerOrg}</td>
                <td>{s.deviceIds.length}</td>
                <td>
                  <span className={statusClass(s.status)}>{s.status}</span>
                </td>
                <td className="r">
                  <Link href={`/sessions/${s.id}`}>Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
