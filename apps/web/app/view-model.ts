/** Passage de l'état du worker aux vues. Pas de logique métier ici : elle vit dans @coly/core. */

import {
  buildHome,
  type HomeShipment,
  type HomeView,
  isMeaningfulPlace,
  mergeTimeline,
  type SourcedEvent,
  type UserStatus,
} from "@coly/core";
import type { ColyState, ShipmentState } from "@coly/worker/sync";

export const CARRIERS: Record<string, string> = {
  laposte: "La Poste",
  colissimo: "Colissimo",
  chronopost: "Chronopost",
  dpd: "DPD",
  mondial_relay: "Mondial Relay",
  colis_prive: "Colis Privé",
  gls: "GLS",
  ups: "UPS",
  dhl: "DHL",
  fedex: "FedEx",
  amazon_logistics: "Amazon",
  unknown: "Transporteur inconnu",
};

export const SOURCES: Record<string, string> = { laposte: "La Poste", ship24: "Ship24" };

export const STATUS_LABEL: Record<UserStatus, { label: string; tone: string }> = {
  ordered: { label: "Commandé", tone: "transit" },
  shipped: { label: "Expédié", tone: "transit" },
  in_transit: { label: "En transit", tone: "transit" },
  out_for_delivery: { label: "Aujourd'hui", tone: "transit" },
  available_for_pickup: { label: "À retirer", tone: "pickup" },
  delivered: { label: "Livré", tone: "done" },
  picked_up: { label: "Retiré", tone: "done" },
  returned: { label: "Retourné", tone: "done" },
  problem: { label: "Problème", tone: "problem" },
};

/** « notification.undiz.com » → « Undiz ». */
export function merchantName(domain: string): string {
  const parts = domain.split(".");
  const name = parts.length >= 2 ? parts[parts.length - 2] : domain;
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : domain;
}

export const carrierName = (s: ShipmentState) =>
  CARRIERS[s.candidate.carrier] ?? s.candidate.carrier;

/** Arrivée au point de retrait, d'après les événements du transporteur. */
export function availableSince(s: ShipmentState): string | undefined {
  return s.snapshots
    .flatMap((snap) => snap.events)
    .filter((e) =>
      /available_for_pickup|AG1|parcelshop|relais|retrait/i.test(`${e.code} ${e.label}`),
    )
    .map((e) => e.at)
    .filter((at): at is string => Boolean(at))
    .sort()[0];
}

export function timeline(s: ShipmentState): SourcedEvent[] {
  return mergeTimeline(
    s.snapshots.flatMap((snap) =>
      snap.events.map((e) => {
        const event: SourcedEvent = { source: snap.source, label: e.label };
        if (e.at) event.at = e.at;
        if (isMeaningfulPlace(e.location)) event.location = e.location;
        if (e.courier) event.courier = e.courier;
        return event;
      }),
    ),
  );
}

export function toHomeView(state: ColyState, now: Date): HomeView & { archived: number } {
  const active = state.shipments.filter((s) => !s.presumedDone);
  const shipments: HomeShipment[] = active.map((s) => {
    const home: HomeShipment = {
      id: s.id,
      merchant: merchantName(s.merchant),
      carrier: carrierName(s),
      status: s.status,
    };
    const since = availableSince(s);
    if (since) home.availableSince = since;
    // Faute de nom de relais transmis par la source, on nomme le réseau plutôt que d'inventer.
    if (s.status === "available_for_pickup")
      home.placeName = s.placeName ?? `Point relais ${carrierName(s)}`;
    if (s.lastUpdate) home.lastUpdate = s.lastUpdate;
    return home;
  });
  return { ...buildHome(shipments, now), archived: state.shipments.length - active.length };
}
