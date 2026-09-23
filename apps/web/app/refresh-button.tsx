"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function refresh() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) setError(body.error ?? "Actualisation impossible.");
      router.refresh();
    } catch {
      setError("Serveur injoignable. Le Mac est-il allumé ?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        className="icon-button"
        aria-label="Actualiser les statuts"
        aria-busy={busy}
        disabled={busy}
        onClick={refresh}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
        </svg>
      </button>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
