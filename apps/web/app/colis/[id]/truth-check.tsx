"use client";

import type { UserStatus } from "@coly/core";
import { useState } from "react";

const CHOICES: { status: UserStatus; label: string }[] = [
  { status: "in_transit", label: "En route" },
  { status: "out_for_delivery", label: "En livraison aujourd'hui" },
  { status: "available_for_pickup", label: "À retirer" },
  { status: "picked_up", label: "Déjà retiré" },
  { status: "delivered", label: "Livré" },
  { status: "returned", label: "Retourné à l'expéditeur" },
  { status: "problem", label: "Problème" },
];

/** Vérité de référence : alimente l'indicateur « statut juste » du rapport de couverture. */
export function TruthCheck({ id, shown }: { id: string; shown: UserStatus | null }) {
  const [state, setState] = useState<"ask" | "choose" | "saved" | "error">("ask");

  async function save(status: UserStatus) {
    const response = await fetch("/api/verite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status, shown }),
    }).catch(() => undefined);
    setState(response?.ok ? "saved" : "error");
  }

  if (state === "saved") return <p className="meta">Merci.</p>;
  if (state === "error") return <p className="error">Enregistrement impossible.</p>;

  return (
    <section className="truth">
      <p className="truth-question">Ce statut est-il juste ?</p>
      {state === "ask" ? (
        <div className="truth-actions">
          <button type="button" disabled={shown === null} onClick={() => shown && save(shown)}>
            Oui
          </button>
          <button type="button" onClick={() => setState("choose")}>
            Non
          </button>
        </div>
      ) : (
        <div className="truth-actions">
          {CHOICES.filter((c) => c.status !== shown).map((c) => (
            <button key={c.status} type="button" onClick={() => save(c.status)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
