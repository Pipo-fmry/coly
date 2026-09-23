/**
 * Modèle de domaine Coly — squelette.
 * Ce package est PUR : aucune I/O, aucun SDK tiers, aucune date « maintenant » implicite.
 * Voir docs/architecture/overview.md et docs/adr/0003, 0005.
 */

export * from "./carriers.ts";
export * from "./home.ts";
export * from "./mail-filter.ts";
export * from "./status.ts";

/** D'où vient une information. Toujours portée par la donnée (cf. provenance). */
export type SourceType = "email" | "carrier_api" | "aggregator" | "user";

export interface Provenance {
  source: SourceType;
  /** Référence de la source : id de message Gmail, id d'appel API… jamais le contenu. */
  sourceRef: string;
  observedAt: Date;
  confidence: "certain" | "probable";
}

/** Code transporteur interne, ex. "colissimo", "chronopost", "dpd", "mondial_relay". */
export type CarrierCode = string;

/** Un numéro de suivi n'est qu'un identifiant de requête vers une source. */
export interface TrackingIdentity {
  carrier: CarrierCode;
  trackingNumber: string;
  role: "first_mile" | "linehaul" | "last_mile" | "return";
  provenance: Provenance;
}

/** Statut affiché à l'utilisateur. Toujours DÉRIVÉ des événements, jamais stocké comme vérité. */
export type UserStatus =
  | "ordered"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "available_for_pickup"
  | "delivered"
  | "picked_up"
  | "returned"
  | "problem";

/** Événement logistique normalisé, append-only. */
export interface ShipmentEvent {
  status: UserStatus;
  occurredAt: Date;
  carrier: CarrierCode;
  rawCode?: string;
  rawLabel?: string;
  provenance: Provenance;
}

/** Lieu de retrait canonique : un commerce physique, possiblement présent dans plusieurs réseaux. */
export interface PickupLocation {
  id: string;
  name: string;
  address: string;
  /** Identifiants réseau regroupés sous ce lieu, ex. ["pickup:12345", "mondial_relay:FR-067890"]. */
  networkIds: string[];
}

/** Unité logistique perçue par l'utilisateur, même si plusieurs transporteurs interviennent. */
export interface Shipment {
  id: string;
  orderIds: string[];
  identities: TrackingIdentity[];
  events: ShipmentEvent[];
  pickupLocationId?: string;
  /** Date limite de retrait : donnée par le transporteur, sinon estimée (et marquée comme telle). */
  pickupDeadline?: { at: Date; estimated: boolean };
}

export interface Order {
  id: string;
  merchant: string;
  orderRef?: string;
  orderedAt?: Date;
  provenance: Provenance;
}
