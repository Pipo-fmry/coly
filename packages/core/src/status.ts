/**
 * Statut utilisateur dérivé des observations des sources (ADR 0005).
 * Règles v0 : rang monotone (on ne recule pas sans raison), un état terminal l'emporte toujours,
 * « problème » seulement si l'observation la plus récente le signale et qu'aucun état terminal n'est connu.
 */

import type { UserStatus } from "./index.ts";

export interface StatusObservation {
  source: "laposte" | "ship24" | "email";
  status: UserStatus;
  /** Horodatage de l'événement source, ISO 8601. */
  at?: string;
}

const RANK: Record<UserStatus, number> = {
  ordered: 0,
  shipped: 1,
  in_transit: 2,
  problem: 2,
  out_for_delivery: 3,
  available_for_pickup: 4,
  delivered: 5,
  picked_up: 5,
  returned: 5,
};

const TERMINAL = new Set<UserStatus>(["delivered", "picked_up", "returned"]);

/** Statuts Ship24 (`statusMilestone`) → statut Coly. */
export function fromShip24Milestone(milestone: string | undefined): UserStatus | undefined {
  switch (milestone) {
    case "info_received":
      return "shipped";
    case "in_transit":
      return "in_transit";
    case "out_for_delivery":
      return "out_for_delivery";
    case "available_for_pickup":
      return "available_for_pickup";
    case "delivered":
      return "delivered";
    case "failed_attempt":
    case "exception":
      return "problem";
    default:
      return undefined;
  }
}

/** Codes d'événement La Poste Suivi v2 → statut Coly (codes non listés : ignorés plutôt que devinés). */
export function fromLaPosteCode(code: string | undefined): UserStatus | undefined {
  if (!code) return undefined;
  if (code === "DI1") return "delivered";
  if (code === "DI2" || code === "RE1") return "returned";
  if (code === "AG1") return "available_for_pickup";
  if (code === "MD2") return "out_for_delivery";
  if (code === "ND1" || code.startsWith("PB")) return "problem";
  if (/^(PC|ET|EP|DO)\d$/.test(code)) return "in_transit";
  return undefined;
}

export function deriveStatus(observations: readonly StatusObservation[]): UserStatus | undefined {
  if (observations.length === 0) return undefined;
  const terminal = observations.filter((o) => TERMINAL.has(o.status));
  const pool = terminal.length > 0 ? terminal : observations;
  const latest = [...pool].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
  if (latest?.status === "problem" && terminal.length === 0) return "problem";
  return pool
    .filter((o) => o.status !== "problem")
    .reduce<UserStatus | undefined>(
      (best, o) => (best === undefined || RANK[o.status] > RANK[best] ? o.status : best),
      undefined,
    );
}
