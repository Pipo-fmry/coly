/**
 * Fournisseurs de faits (ADR 0016) : chaque source connue du worker traduit ce qu'elle sait en faits typés.
 * Le choix de la valeur affichée appartient au moteur de fusion de @coly/core, jamais à un fournisseur.
 */

import {
  fuseMerchant,
  isCarrierDomain,
  isMeaningfulPlace,
  type MerchantFact,
  merchantNameFromDomain,
  type PlaceFact,
  type SourceKind,
  shipperFromEvent,
  shopName,
} from "@coly/core";
import type { ColyState, ShipmentState, Sighting } from "./sync.ts";
import type { TrackingSnapshot } from "./tracking/types.ts";

/** Un email sans numéro est rattaché à un colis s'il arrive dans cette fenêtre autour du premier email du colis. */
const NEARBY_DAYS_BEFORE = 3;
const NEARBY_DAYS_AFTER = 1;
const DAY_MS = 86_400_000;

const trackingKind = (s: TrackingSnapshot): SourceKind =>
  s.source === "laposte" ? "official_api" : "aggregator";

// Nettoyé à la lecture aussi : les noms stockés avant une amélioration en profitent sans resynchro.
const senderLabel = (s: Sighting) =>
  (s.senderName && shopName(s.senderName)) || merchantNameFromDomain(s.senderDomain);

function firstSeen(row: ShipmentState): number | undefined {
  const first = row.sightings
    .map((s) => s.date)
    .sort()
    .at(0);
  return first ? Date.parse(first) : undefined;
}

export function merchantFacts(row: ShipmentState, orphans: readonly Sighting[]): MerchantFact[] {
  const facts: MerchantFact[] = [];
  if (row.merchantLabel)
    facts.push({
      field: "merchant",
      value: row.merchantLabel,
      kind: "carrier_email",
      confidence: "certain",
      sourceRef: "email transporteur",
    });
  for (const s of row.sightings.filter((x) => !isCarrierDomain(x.senderDomain)))
    facts.push({
      field: "merchant",
      value: senderLabel(s),
      kind: "sender",
      confidence: "certain",
      sourceRef: `email ${s.senderDomain}`,
      observedAt: s.date,
    });
  for (const snapshot of row.snapshots)
    for (const event of snapshot.events) {
      const shipper = shipperFromEvent(event.label);
      if (shipper)
        facts.push({
          field: "merchant",
          value: shipper,
          kind: trackingKind(snapshot),
          confidence: "probable",
          sourceRef: `suivi ${snapshot.source}`,
          ...(event.at && { observedAt: event.at }),
        });
    }
  const first = firstSeen(row);
  if (first !== undefined)
    for (const s of orphans) {
      const delta = (first - Date.parse(s.date)) / DAY_MS;
      if (
        isCarrierDomain(s.senderDomain) ||
        delta > NEARBY_DAYS_BEFORE ||
        delta < -NEARBY_DAYS_AFTER
      )
        continue;
      facts.push({
        field: "merchant",
        value: senderLabel(s),
        kind: "nearby_email",
        confidence: "probable",
        sourceRef: `email ${s.senderDomain} du ${s.date}`,
        observedAt: s.date,
      });
    }
  return facts;
}

const PICKUP_EVENT = /pickup|relais|retrait|parcelshop|point/i;

export function placeFacts(row: ShipmentState): PlaceFact[] {
  const facts: PlaceFact[] = [];
  for (const e of row.carrierEmails)
    if (e.pickupPoint)
      facts.push({
        field: "place",
        value: e.pickupPoint,
        kind: "carrier_email",
        confidence: "certain",
        sourceRef: "email transporteur",
        observedAt: e.receivedAt,
      });
  for (const snapshot of row.snapshots) {
    const kind = trackingKind(snapshot);
    const sourceRef = `suivi ${snapshot.source}`;
    if (snapshot.removalPoint?.name)
      facts.push({
        field: "place",
        value: { name: snapshot.removalPoint.name },
        kind,
        confidence: "certain",
        sourceRef,
        observedAt: snapshot.fetchedAt,
      });
    // Lieu d'un événement de mise en relais : moins sûr qu'un point de retrait déclaré.
    const pickup = snapshot.events.find((e) => PICKUP_EVENT.test(e.code ?? e.label));
    if (isMeaningfulPlace(pickup?.location))
      facts.push({
        field: "place",
        value: { name: pickup.location },
        kind,
        confidence: "probable",
        sourceRef,
        ...(pickup.at && { observedAt: pickup.at }),
      });
  }
  return facts;
}

/** Marchand d'un colis, fusionné depuis toutes les sources, y compris les emails sans numéro de la boîte. */
export const shipmentMerchant = (row: ShipmentState, state: Pick<ColyState, "readWithoutNumber">) =>
  fuseMerchant(merchantFacts(row, state.readWithoutNumber));
