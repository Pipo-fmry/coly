/**
 * Tri d'un email sur ses seuls en-têtes (expéditeur, sujet), AVANT d'en lire le contenu (ADR 0013).
 * Principe : dans le doute, on ne lit pas. Un colis raté se rattrape (saisie, partage) ; un email lu à tort, non.
 */

export interface MailHeader {
  from: string;
  subject: string;
}

export type MailDecision =
  | { read: true; reason: "carrier_sender" | "transactional_subject" }
  | { read: false; reason: "marketing" | "not_transactional" };

/** Domaines d'expéditeurs transporteurs : leurs emails concernent toujours un colis. */
const CARRIER_SENDERS =
  /@([a-z0-9-]+\.)*(laposte\.fr|colissimo\.fr|chronopost\.fr|dpd\.(fr|com)|pickup\.fr|mondialrelay\.(fr|com)|inpost\.[a-z]+|relaiscolis\.com|colisprive\.(fr|com)|gls-(france\.com|group\.eu)|ups\.com|dhl\.(com|fr|de)|fedex\.com|vintedgo\.com)>?$/i;

/** Sujets transactionnels : une commande ou un colis précis, pas une offre. */
const TRANSACTIONAL_SUBJECT =
  /\b(commande|order|expédi|expedi|shipped|colis|livr|delivery|retrait|point relais|disponible|suivi de (votre|ton|la) (colis|commande|livraison)|tracking)/i;

/** Signaux marketing : « livraison offerte », remises, soldes… jamais lus, même avec un mot-clé transactionnel. */
const MARKETING_SUBJECT =
  /(livraison (offerte|gratuite)|frais de port offerts|-?\d+ ?%|soldes|promo|code promo|black friday|newsletter|offre|jusqu'à|derniers jours|vente privée|nouveautés|découvrez)/i;

export function decideMailRead(header: MailHeader): MailDecision {
  const from = header.from.trim();
  if (CARRIER_SENDERS.test(from)) return { read: true, reason: "carrier_sender" };
  if (MARKETING_SUBJECT.test(header.subject)) return { read: false, reason: "marketing" };
  if (TRANSACTIONAL_SUBJECT.test(header.subject))
    return { read: true, reason: "transactional_subject" };
  return { read: false, reason: "not_transactional" };
}
