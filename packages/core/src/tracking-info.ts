/**
 * Règles d'affichage de l'information logistique (ADR 0015) :
 * la plus juste, d'où qu'elle vienne ; à défaut, le lien vers la page officielle du transporteur.
 */

import type { DetectedCarrier } from "./carriers.ts";

const TRACKING_PAGES: Partial<Record<DetectedCarrier, (n: string) => string>> = {
  laposte: (n) => `https://www.laposte.fr/outils/suivre-vos-envois?code=${n}`,
  colissimo: (n) => `https://www.laposte.fr/outils/suivre-vos-envois?code=${n}`,
  chronopost: (n) => `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${n}`,
  dpd: (n) => `https://trace.dpd.fr/fr/trace/${n}`,
  mondial_relay: (n) => `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${n}`,
  colis_prive: (n) => `https://www.colisprive.com/moncolis/pages/detailColis.aspx?numColis=${n}`,
  gls: (n) => `https://gls-group.eu/FR/fr/suivi-colis?match=${n}`,
  ups: (n) => `https://www.ups.com/track?loc=fr_FR&tracknum=${n}`,
  dhl: (n) => `https://www.dhl.com/fr-fr/home/suivi.html?tracking-id=${n}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
};

/** Page de suivi officielle du transporteur, quand on sait la construire. */
export function carrierTrackingUrl(
  carrier: DetectedCarrier,
  trackingNumber: string,
): string | undefined {
  return TRACKING_PAGES[carrier]?.(encodeURIComponent(trackingNumber));
}

/** Un lieu exploitable : pas vide, pas un simple code pays (« FR ») comme en renvoient certaines sources. */
export function isMeaningfulPlace(location: string | undefined): location is string {
  if (!location) return false;
  const trimmed = location.trim();
  return trimmed.length > 2 && !/^[A-Z]{2}$/i.test(trimmed);
}

export interface SourcedEvent {
  source: string;
  label: string;
  at?: string;
  location?: string;
  courier?: string;
}

/** Frise unique, toutes sources confondues : doublons (même instant, même libellé) retirés, plus récent d'abord. */
export function mergeTimeline(events: readonly SourcedEvent[]): SourcedEvent[] {
  const seen = new Set<string>();
  return [...events]
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .filter((e) => {
      const key = `${e.at?.slice(0, 16)}|${e.label.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Jours entiers écoulés depuis une date ISO. */
export function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
}

/**
 * Colis ancien (première installation) : dernier email vieux de plus de `maxAgeDays` et aucun statut connu.
 * On ne dépense pas de quota de tracking dessus : il est présumé terminé.
 */
export function isPresumedDone(
  lastSeen: string,
  hasStatus: boolean,
  now: Date,
  maxAgeDays = 30,
): boolean {
  return !hasStatus && daysSince(lastSeen, now) > maxAgeDays;
}

/**
 * Certains transporteurs écrivent le lieu en tête du libellé (« MARSEILLE - FR - SHOP N FOOD, Available at
 * retrieval point ») au lieu du champ prévu. On le range à sa place, une fois, à la lecture de la source.
 * Seulement pour un préfixe en capitales : une phrase ordinaire (« Votre colis est livré, merci ») reste intacte.
 */
export function normalizeEvent<E extends { label: string; location?: string }>(event: E): E {
  if (event.location) return event;
  const [, prefix, rest] = /^([^,]{3,60}),\s*(\S.*)$/.exec(event.label) ?? [];
  const letters = prefix?.replace(/[^\p{L}]/gu, "") ?? "";
  if (!prefix || !rest || letters.length < 3 || letters !== letters.toUpperCase()) return event;
  return { ...event, label: rest, location: prefix.trim() };
}

/** « MARSEILLE - FR - SHOP N  FOOD » → relais « SHOP N FOOD » à Marseille ; sinon le nom tel quel. */
export function parseEventPlace(location: string): { name: string; locality?: string } {
  const clean = location.replace(/\s+/g, " ").trim();
  const [, locality, name] = /^(.+?) - [A-Z]{2} - (.+)$/.exec(clean) ?? [];
  return locality && name ? { name, locality } : { name: clean };
}
