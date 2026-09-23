/** API La Poste Suivi v2 (Colissimo, Chronopost, courrier suivi). Clé Okapi gratuite. */

import type { TrackingSnapshot } from "./types.ts";

interface LaPosteResponse {
  returnCode?: number;
  returnMessage?: string;
  shipment?: {
    idShip: string;
    product?: string;
    isFinal?: boolean;
    holder?: number;
    event?: { code?: string; label?: string; date?: string }[];
    contextData?: {
      removalPoint?: { name?: string; type?: string };
      partner?: { name?: string; network?: string; reference?: string };
    };
  };
}

export async function trackLaPoste(key: string, trackingNumber: string): Promise<TrackingSnapshot> {
  const response = await fetch(
    `https://api.laposte.fr/suivi/v2/idships/${encodeURIComponent(trackingNumber)}?lang=fr_FR`,
    { headers: { "X-Okapi-Key": key, accept: "application/json" } },
  );
  const body = (await response.json().catch(() => ({}))) as LaPosteResponse;
  const shipment = body.shipment;
  if (!response.ok || !shipment) {
    return {
      source: "laposte",
      trackingNumber,
      found: false,
      relatedNumbers: [],
      error: `${response.status} ${body.returnMessage ?? ""}`.trim(),
    };
  }
  // Les événements La Poste arrivent du plus récent au plus ancien.
  const last = shipment.event?.[0];
  const { partner, removalPoint } = shipment.contextData ?? {};
  const snapshot: TrackingSnapshot = {
    source: "laposte",
    trackingNumber,
    found: true,
    relatedNumbers: partner?.reference ? [partner.reference] : [],
  };
  if (last) {
    snapshot.lastEvent = { label: last.label ?? "" };
    if (last.code) snapshot.lastEvent.code = last.code;
    if (last.date) snapshot.lastEvent.at = last.date;
  }
  if (shipment.product) snapshot.carrierSeen = shipment.product;
  if (shipment.isFinal !== undefined) snapshot.isFinal = shipment.isFinal;
  if (partner) snapshot.partner = partner;
  if (removalPoint) snapshot.removalPoint = removalPoint;
  return snapshot;
}
