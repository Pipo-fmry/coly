/** Agrégateur Ship24 (plan gratuit : 10 colis/mois + 100 le 1er mois). Chaque nouveau numéro consomme 1 quota. */

import type { TrackingSnapshot } from "./types.ts";

interface Ship24Response {
  data?: {
    trackings?: {
      shipment?: { statusMilestone?: string; trackingNumbers?: { tn: string }[] };
      events?: {
        status?: string;
        statusCode?: string;
        occurrenceDatetime?: string;
        location?: string;
        courierCode?: string;
      }[];
    }[];
  };
  errors?: { message?: string }[];
}

export async function trackShip24(key: string, trackingNumber: string): Promise<TrackingSnapshot> {
  const response = await fetch("https://api.ship24.com/public/v1/trackers/track", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ trackingNumber, destinationCountryCode: "FR" }),
  });
  const body = (await response.json().catch(() => ({}))) as Ship24Response;
  const tracking = body.data?.trackings?.[0];
  if (!response.ok || !tracking) {
    return {
      source: "ship24",
      trackingNumber,
      found: false,
      relatedNumbers: [],
      error: `${response.status} ${body.errors?.[0]?.message ?? ""}`.trim(),
    };
  }
  // Ship24 : événements du plus récent au plus ancien.
  const last = tracking.events?.[0];
  const couriers = [...new Set((tracking.events ?? []).map((e) => e.courierCode).filter(Boolean))];
  const snapshot: TrackingSnapshot = {
    source: "ship24",
    trackingNumber,
    found: (tracking.events?.length ?? 0) > 0,
    relatedNumbers: (tracking.shipment?.trackingNumbers ?? [])
      .map((t) => t.tn)
      .filter((tn) => tn !== trackingNumber),
  };
  if (last) {
    snapshot.lastEvent = { label: last.status ?? "" };
    if (last.statusCode) snapshot.lastEvent.code = last.statusCode;
    if (last.occurrenceDatetime) snapshot.lastEvent.at = last.occurrenceDatetime;
    if (last.location) snapshot.lastEvent.location = last.location;
  }
  if (tracking.shipment?.statusMilestone) snapshot.sourceStatus = tracking.shipment.statusMilestone;
  if (couriers.length > 0) snapshot.carrierSeen = couriers.join(" → ");
  return snapshot;
}
