/**
 * Vue d'accueil (vision produit, « Premier écran ») : urgent d'abord, puis les lieux, puis en route.
 * Pur : reçoit « maintenant » en paramètre.
 */

import type { UserStatus } from "./index.ts";

export interface HomeShipment {
  id: string;
  merchant: string;
  carrier: string;
  status: UserStatus | undefined;
  /** Nom du lieu de retrait, tel que donné par la source (dédoublonnage inter-réseaux : plus tard). */
  placeName?: string;
  /** Date limite de retrait ISO, si connue. */
  pickupDeadline?: string;
  lastUpdate?: string;
}

export interface HomePlace {
  name: string;
  shipments: HomeShipment[];
  earliestDeadline?: string;
}

export interface HomeView {
  urgent: HomeShipment[];
  places: HomePlace[];
  inTransit: HomeShipment[];
  done: HomeShipment[];
  unknown: HomeShipment[];
}

const DAY_MS = 86_400_000;

/** Jours pleins restants avant la date limite (0 = dernier jour). */
export function daysLeft(deadline: string, now: Date): number {
  return Math.floor((Date.parse(deadline) - now.getTime()) / DAY_MS);
}

function isUrgent(s: HomeShipment, now: Date): boolean {
  if (s.status === "problem") return true;
  return (
    s.status === "available_for_pickup" &&
    s.pickupDeadline !== undefined &&
    daysLeft(s.pickupDeadline, now) <= 1
  );
}

export function buildHome(shipments: readonly HomeShipment[], now: Date): HomeView {
  const view: HomeView = { urgent: [], places: [], inTransit: [], done: [], unknown: [] };
  const places = new Map<string, HomePlace>();

  for (const s of shipments) {
    if (isUrgent(s, now)) view.urgent.push(s);
    else if (s.status === "available_for_pickup") {
      const name = s.placeName ?? "Lieu de retrait inconnu";
      const place = places.get(name) ?? { name, shipments: [] };
      place.shipments.push(s);
      if (
        s.pickupDeadline &&
        (!place.earliestDeadline || s.pickupDeadline < place.earliestDeadline)
      )
        place.earliestDeadline = s.pickupDeadline;
      places.set(name, place);
    } else if (s.status === "delivered" || s.status === "picked_up" || s.status === "returned")
      view.done.push(s);
    else if (s.status === undefined) view.unknown.push(s);
    else view.inTransit.push(s);
  }

  view.places = [...places.values()].sort(
    (a, b) =>
      (a.earliestDeadline ?? "9999").localeCompare(b.earliestDeadline ?? "9999") ||
      b.shipments.length - a.shipments.length,
  );
  return view;
}
