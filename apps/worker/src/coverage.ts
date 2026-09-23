/**
 * Rapport de couverture (docs/plan/roadmap.md) : on décide sur ces indicateurs, jamais sur un colis isolé.
 * Fonction pure : état + vérité de référence + heure courante → indicateurs, par transporteur et au global.
 */

import type { GroundTruth } from "./ground-truth.ts";
import type { ColyState, ShipmentState } from "./sync.ts";

export interface Ratio {
  hits: number;
  total: number;
}

export interface CoverageRow {
  active: number;
  statusKnown: Ratio;
  /** Seulement sur les colis vérifiés par l'utilisateur. */
  statusCorrect: Ratio;
  /** Âge médian (heures) de la dernière information transporteur, colis actifs non terminés. */
  medianFreshnessHours: number | null;
  pickup: {
    total: number;
    place: Ratio;
    address: Ratio;
    deadline: Ratio;
    codeOrQr: Ratio;
  };
}

export interface CoverageReport {
  generatedAt: string;
  global: CoverageRow;
  byCarrier: Record<string, CoverageRow>;
  presumedDone: number;
  carrierEmailsNotUnderstood: Record<string, number>;
}

const TERMINAL = new Set(["delivered", "picked_up", "returned"]);

const ratio = (items: readonly unknown[], test: (x: never) => boolean): Ratio => ({
  hits: items.filter((x) => test(x as never)).length,
  total: items.length,
});

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function row(shipments: readonly ShipmentState[], truth: GroundTruth, now: Date): CoverageRow {
  const verified = shipments.filter((s) => truth[s.id]);
  const pickups = shipments.filter((s) => s.status === "available_for_pickup");
  const freshness = shipments
    .filter((s) => s.lastUpdate && !(s.status && TERMINAL.has(s.status)))
    .map((s) => (now.getTime() - Date.parse(s.lastUpdate ?? "")) / 3_600_000);

  return {
    active: shipments.length,
    statusKnown: ratio(shipments, (s: ShipmentState) => s.status !== undefined),
    statusCorrect: ratio(verified, (s: ShipmentState) => truth[s.id]?.status === s.status),
    medianFreshnessHours: median(freshness),
    pickup: {
      total: pickups.length,
      place: ratio(pickups, (s: ShipmentState) => Boolean(s.placeName)),
      address: ratio(pickups, (s: ShipmentState) => Boolean(s.placeAddress)),
      // Aucune source ne fournit encore de date limite : l'indicateur le rendra visible.
      deadline: ratio(pickups, () => false),
      codeOrQr: ratio(pickups, (s: ShipmentState) =>
        s.carrierEmails.some((e) => e.hasPickupQrCode),
      ),
    },
  };
}

export function computeCoverage(state: ColyState, truth: GroundTruth, now: Date): CoverageReport {
  const active = state.shipments.filter((s) => !s.presumedDone);
  const byCarrier: Record<string, CoverageRow> = {};
  for (const carrier of new Set(active.map((s) => s.candidate.carrier)))
    byCarrier[carrier] = row(
      active.filter((s) => s.candidate.carrier === carrier),
      truth,
      now,
    );
  return {
    generatedAt: now.toISOString(),
    global: row(active, truth, now),
    byCarrier,
    presumedDone: state.shipments.length - active.length,
    carrierEmailsNotUnderstood: state.counts.carrierEmailsNotUnderstood ?? {},
  };
}
