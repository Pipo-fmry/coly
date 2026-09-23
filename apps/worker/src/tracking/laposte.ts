/** API La Poste Suivi v2 (Colissimo, Chronopost, courrier suivi). Clé Okapi gratuite. */

import type { TrackingEvent, TrackingSnapshot } from "./types.ts";

interface LaPosteResponse {
  returnMessage?: string;
  message?: string;
  shipment?: {
    idShip: string;
    product?: string;
    isFinal?: boolean;
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
  const fetchedAt = new Date().toISOString();
  const shipment = body.shipment;
  if (!response.ok || !shipment) {
    return {
      source: "laposte",
      trackingNumber,
      found: false,
      fetchedAt,
      events: [],
      relatedNumbers: [],
      error: `${response.status} ${body.returnMessage ?? body.message ?? ""}`.trim(),
    };
  }

  // Les événements La Poste arrivent du plus récent au plus ancien.
  const events = (shipment.event ?? []).map((e) => {
    const event: TrackingEvent = { label: e.label ?? "" };
    if (e.code) event.code = e.code;
    if (e.date) event.at = e.date;
    if (shipment.product) event.courier = shipment.product;
    return event;
  });
  const { partner, removalPoint } = shipment.contextData ?? {};
  const snapshot: TrackingSnapshot = {
    source: "laposte",
    trackingNumber,
    found: true,
    fetchedAt,
    events,
    relatedNumbers: partner?.reference ? [partner.reference] : [],
  };
  if (events[0]) snapshot.lastEvent = events[0];
  if (shipment.product) snapshot.carrierSeen = shipment.product;
  if (shipment.isFinal !== undefined) snapshot.isFinal = shipment.isFinal;
  if (partner) snapshot.partner = partner;
  if (removalPoint) snapshot.removalPoint = removalPoint;
  return snapshot;
}
