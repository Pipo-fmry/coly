/** Passage de l'état du worker à la vue d'accueil. Pas de logique métier ici : elle vit dans @coly/core. */

import { buildHome, type HomeShipment, type HomeView, type UserStatus } from "@coly/core";
import type { ColyState } from "@coly/worker/sync";

const CARRIERS: Record<string, string> = {
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
function merchantName(domain: string): string {
  const parts = domain.split(".");
  const name = parts.length >= 2 ? parts[parts.length - 2] : domain;
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : domain;
}

export function toHomeView(state: ColyState, now: Date): HomeView {
  const shipments: HomeShipment[] = state.shipments.map((s) => {
    const home: HomeShipment = {
      id: s.id,
      merchant: merchantName(s.merchant),
      carrier: CARRIERS[s.candidate.carrier] ?? s.candidate.carrier,
      status: s.status,
    };
    if (s.placeName) home.placeName = s.placeName;
    if (s.lastUpdate) home.lastUpdate = s.lastUpdate;
    return home;
  });
  return buildHome(shipments, now);
}
