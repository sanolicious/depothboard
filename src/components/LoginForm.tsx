"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

type DemoHint = {
  email: string;
  password: string;
  name: string;
  role: string;
  athleteSlug: string | null;
  notes?: string;
};

export function LoginForm({
  nextPath = "/account",
  demos,
}: {
  nextPath?: string;
  demos: DemoHint[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(demos[0]?.email ?? "");
  const [password, setPassword] = useState(demos[0]?.password ?? "demo");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Login failed");
      }
      router.push(nextPath || "/account");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Login failed");
    }
  }

  function fill(demo: DemoHint) {
    setEmail(demo.email);
    setPassword(demo.password);
    setMessage("");
    setStatus("idle");
  }

  return (
    <div className="grid grid-2" style={{ gap: 24, alignItems: "start" }}>
      <form className="card" style={{ padding: 24 }} onSubmit={onSubmit}>
        <h2 style={{ fontSize: "1.2rem" }}>Sign in</h2>
        <p className="muted small" style={{ marginTop: 8 }}>
          Credentials demo (cookie session). Magic-link email delivery is not
          wired — use a seed password below.
        </p>
        <label className="stack" style={{ gap: 6, marginTop: 18, marginBottom: 14 }}>
          <span className="small">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        <label className="stack" style={{ gap: 6, marginBottom: 18 }}>
          <span className="small">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
        <button
          className="btn btn--primary"
          type="submit"
          disabled={status === "sending"}
        >
          <Icon name="user" />
          {status === "sending" ? "Signing in…" : "Sign in"}
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
      </form>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: "1.2rem" }}>Demo accounts</h2>
        <p className="muted small" style={{ marginTop: 8 }}>
          Click to fill the form. Password for all demos: <code>demo</code>
        </p>
        <ul
          className="stack"
          style={{ gap: 10, marginTop: 16, listStyle: "none", padding: 0 }}
        >
          {demos.map((d) => (
            <li key={d.email}>
              <button
                type="button"
                className="btn btn--ghost btn--block"
                style={{ justifyContent: "flex-start", textAlign: "left" }}
                onClick={() => fill(d)}
              >
                <span>
                  <strong>{d.name}</strong>
                  <span className="caption" style={{ display: "block" }}>
                    {d.email} · {d.role}
                    {d.athleteSlug ? ` · ${d.athleteSlug}` : " · no claim"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
