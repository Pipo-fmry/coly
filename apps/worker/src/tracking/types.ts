/** Événement tel que donné par une source, normalisé mais non interprété. */
export interface TrackingEvent {
  label: string;
  code?: string;
  /** Horodatage ISO 8601 donné par la source. */
  at?: string;
  location?: string;
  /** Transporteur ayant émis l'événement (utile quand le colis change de mains). */
  courier?: string;
}

/** Résultat brut d'une source de tracking (le statut utilisateur se dérive dans core, ADR 0005). */
export interface TrackingSnapshot {
  source: "laposte" | "ship24";
  trackingNumber: string;
  found: boolean;
  fetchedAt: string;
  /** Tous les événements, du plus récent au plus ancien (ADR 0015 : on ne jette pas l'information). */
  events: TrackingEvent[];
  /** Raccourci vers events[0]. */
  lastEvent?: TrackingEvent;
  /** Statut normalisé par la source elle-même (à ne pas recopier tel quel). */
  sourceStatus?: string;
  isFinal?: boolean;
  carrierSeen?: string;
  estimatedDelivery?: string;
  /** Autres numéros liés au même envoi selon la source (changement de transporteur). */
  relatedNumbers: string[];
  partner?: { name?: string; network?: string; reference?: string };
  removalPoint?: { name?: string; type?: string };
  error?: string;
}
