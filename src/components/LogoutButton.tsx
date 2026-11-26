"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

export function LogoutButton({ className = "btn btn--sm btn--ghost" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={className} type="button" onClick={onClick} disabled={busy}>
      <Icon name="lock" />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
