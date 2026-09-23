/** Résultat brut d'une source de tracking, sans interprétation (le statut utilisateur se dérive dans core). */
export interface TrackingSnapshot {
  source: "laposte" | "ship24";
  trackingNumber: string;
  found: boolean;
  /** Libellé du dernier événement, tel que donné par la source. */
  lastEvent?: { label: string; code?: string; at?: string; location?: string };
  /** Statut normalisé par la source elle-même (à ne pas recopier tel quel). */
  sourceStatus?: string;
  isFinal?: boolean;
  carrierSeen?: string;
  /** Autres numéros liés au même envoi selon la source (changement de transporteur). */
  relatedNumbers: string[];
  /** Transporteur partenaire / dernier kilomètre signalé par la source. */
  partner?: { name?: string; network?: string; reference?: string };
  removalPoint?: { name?: string; type?: string };
  error?: string;
}
