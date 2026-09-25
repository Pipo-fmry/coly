/**
 * Ce qu'il faut montrer au relais : code de retrait écrit en clair ou image du QR / code-barres.
 * Générique : aucune tournure ni aucun gabarit propre à un transporteur (ADR 0017). Le QR n'est jamais régénéré :
 * on désigne l'image que le transporteur a envoyée (AGENTS.md, règle 6).
 */

const MAX_TEXT = 200_000;

const PICKUP_CODE =
  /code\s+(?:de\s+)?(?:retrait|pin|s[ée]curit[ée]|validation|confidentiel)\s*(?:est\s*)?[:：]?\s*([A-Z0-9](?:[ -]?[A-Z0-9]){3,9})\b/i;

/** Code de retrait écrit en clair (« code de retrait : 482913 », « code PIN 4821 »…). */
export function findPickupCode(text: string): string | undefined {
  const code = PICKUP_CODE.exec(text.slice(0, MAX_TEXT))?.[1]?.replace(/[ -]/g, "");
  // Un vrai code contient au moins un chiffre : sinon c'est un mot de la phrase.
  return code && /\d/.test(code) ? code.toUpperCase() : undefined;
}

const PICKUP_IMAGE = /qr|bar[-_ ]?code|code[-_ ]?barre|datamatrix|pdf417|aztec/i;

/**
 * Images d'un email qui peuvent porter le code de retrait, dans l'ordre (`hint` : nom, identifiant, texte
 * alternatif, adresse). Plusieurs : un pixel de suivi peut porter le même nom, c'est au téléchargement de trancher.
 */
export const pickupImages = <T extends { hint: string }>(images: readonly T[]): T[] =>
  images.filter((image) => PICKUP_IMAGE.test(image.hint));
