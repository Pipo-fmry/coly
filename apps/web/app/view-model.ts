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
import { shipmentMerchant } from "@coly/worker/facts";
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

export const SOURCES: Record<string, string> = {
  laposte: "La Poste",
  ship24: "Ship24",
  email: "email transporteur",
};

export const DONE: ReadonlySet<UserStatus> = new Set(["delivered", "picked_up", "returned"]);

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

export const carrierName = (s: ShipmentState) =>
  CARRIERS[s.candidate.carrier] ?? s.candidate.carrier;

/** Arrivée au point de retrait, d'après les événements du transporteur. */
export function availableSince(s: ShipmentState): string | undefined {
  return [
    ...s.snapshots
      .flatMap((snap) => snap.events)
      .filter((e) =>
        /available_for_pickup|AG1|parcelshop|relais|retrait/i.test(`${e.code} ${e.label}`),
      )
      .map((e) => e.at),
    ...s.carrierEmails.filter((e) => e.kind === "available_for_pickup").map((e) => e.receivedAt),
  ]
    .filter((at): at is string => Boolean(at))
    .sort()[0];
}

/** Marchand affiché : fusion de toutes les sources (ADR 0016). Jamais remplacé par le nom du transporteur. */
export const displayMerchant = (s: ShipmentState, state: ColyState) =>
  shipmentMerchant(s, state)?.value ?? "Marchand inconnu";

/** Lieu où le colis va arriver, tant qu'il est en route : relais annoncé par email, sinon celui des sources. */
export function destination(
  s: ShipmentState,
): { name: string; address?: string; on?: string } | undefined {
  const announced = s.carrierEmails.findLast((e) => e.kind === "in_transit" && e.pickupPoint);
  if (announced?.pickupPoint)
    return {
      ...announced.pickupPoint,
      ...(announced.availableOn && { on: announced.availableOn }),
    };
  if (s.placeName) return { name: s.placeName, ...(s.placeAddress && { address: s.placeAddress }) };
  return undefined;
}

/** Livraison estimée par une source de suivi, si elle en donne une. */
export const estimatedDelivery = (s: ShipmentState) =>
  s.snapshots.find((snap) => snap.estimatedDelivery)?.estimatedDelivery;

/** Email transporteur contenant le QR code de retrait, le plus récent. */
export const pickupQrEmail = (s: ShipmentState) =>
  s.carrierEmails.findLast((e) => e.hasPickupQrCode);

/** Ouvre l'email d'origine dans Gmail (le QR code y est affiché tel que le transporteur l'a envoyé). */
export const gmailLink = (messageId: string) =>
  `https://mail.google.com/mail/u/0/#all/${messageId}`;

export function timeline(s: ShipmentState): SourcedEvent[] {
  const fromEmails: SourcedEvent[] = s.carrierEmails.map((e) => ({
    source: "email",
    label:
      e.kind === "available_for_pickup"
        ? `Disponible au relais ${e.pickupPoint?.name ?? ""}`.trim()
        : `En route vers le relais ${e.pickupPoint?.name ?? ""}${e.availableOn ? `, prévu le ${e.availableOn}` : ""}`.trim(),
    at: e.receivedAt,
  }));
  return mergeTimeline([
    ...fromEmails,
    ...s.snapshots.flatMap((snap) =>
      snap.events.map((e) => {
        const event: SourcedEvent = { source: snap.source, label: e.label };
        if (e.at) event.at = e.at;
        if (isMeaningfulPlace(e.location)) event.location = e.location;
        if (e.courier) event.courier = e.courier;
        return event;
      }),
    ),
  ]);
}

export function toHomeView(state: ColyState, now: Date): HomeView & { archived: number } {
  const active = state.shipments.filter((s) => !s.presumedDone);
  const shipments: HomeShipment[] = active.map((s) => {
    const home: HomeShipment = {
      id: s.id,
      merchant: displayMerchant(s, state),
      carrier: carrierName(s),
      status: s.status,
    };
    const since = availableSince(s);
    if (since) home.availableSince = since;
    // Faute de nom de relais transmis par la source, on nomme le réseau plutôt que d'inventer.
    if (s.status === "available_for_pickup")
      home.placeName = s.placeName ?? `Point relais ${carrierName(s)}`;
    else if (s.status && !DONE.has(s.status)) {
      const where = destination(s);
      if (where) home.placeName = where.name;
    }
    if (s.lastUpdate) home.lastUpdate = s.lastUpdate;
    return home;
  });
  return { ...buildHome(shipments, now), archived: state.shipments.length - active.length };
}
