/** Agrégateur Ship24 (plan gratuit : 10 colis/mois + 100 le 1er mois). Chaque nouveau numéro consomme 1 quota. */

import type { TrackingEvent, TrackingSnapshot } from "./types.ts";

interface Ship24Response {
  data?: {
    trackings?: {
      shipment?: {
        statusMilestone?: string;
        trackingNumbers?: { tn: string }[];
        delivery?: { estimatedDeliveryDate?: string | null };
      };
      events?: {
        status?: string;
        statusCode?: string;
        occurrenceDatetime?: string;
        location?: string | null;
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
  const fetchedAt = new Date().toISOString();
  const tracking = body.data?.trackings?.[0];
  if (!response.ok || !tracking) {
    return {
      source: "ship24",
      trackingNumber,
      found: false,
      fetchedAt,
      events: [],
      relatedNumbers: [],
      error: `${response.status} ${body.errors?.[0]?.message ?? ""}`.trim(),
    };
  }

  // Ship24 : événements du plus récent au plus ancien.
  const events = (tracking.events ?? []).map((e) => {
    const event: TrackingEvent = { label: e.status ?? "" };
    if (e.statusCode) event.code = e.statusCode;
    if (e.occurrenceDatetime) event.at = e.occurrenceDatetime;
    if (e.location) event.location = e.location;
    if (e.courierCode) event.courier = e.courierCode;
    return event;
  });
  const couriers = [...new Set(events.map((e) => e.courier).filter(Boolean))];
  const snapshot: TrackingSnapshot = {
    source: "ship24",
    trackingNumber,
    found: events.length > 0,
    fetchedAt,
    events,
    relatedNumbers: (tracking.shipment?.trackingNumbers ?? [])
      .map((t) => t.tn)
      .filter((tn) => tn !== trackingNumber),
  };
  if (events[0]) snapshot.lastEvent = events[0];
  if (tracking.shipment?.statusMilestone) snapshot.sourceStatus = tracking.shipment.statusMilestone;
  if (couriers.length > 0) snapshot.carrierSeen = couriers.reverse().join(" → ");
  const eta = tracking.shipment?.delivery?.estimatedDeliveryDate;
  if (eta) snapshot.estimatedDelivery = eta;
  return snapshot;
}
