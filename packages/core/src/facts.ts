/**
 * Faits typés et moteur de fusion (ADR 0016). Chaque source émet des faits ; une règle par champ, écrite une fois,
 * choisit la valeur affichée. Le moteur ne connaît aucune source ni aucun marchand par son nom : seulement des
 * *genres* de source, classés par précision.
 */

import { isMeaningfulPlace } from "./tracking-info.ts";

export type Confidence = "certain" | "probable";

/**
 * Genre de source :
 * - `carrier_email` : contenu d'un email transporteur ;
 * - `sender` : en-tête d'un email qui cite le numéro de suivi ;
 * - `official_api` / `aggregator` : API de suivi du transporteur, agrégateur ;
 * - `nearby_email` : email sans numéro, reçu juste avant le colis (rattachement par la date).
 */
export type SourceKind =
  | "carrier_email"
  | "sender"
  | "official_api"
  | "aggregator"
  | "nearby_email";

interface FactBase<F extends string, V> {
  field: F;
  value: V;
  kind: SourceKind;
  confidence: Confidence;
  /** Référence affichable de la source (id de message, nom d'API…), jamais le contenu. */
  sourceRef: string;
  observedAt?: string;
}

export interface Place {
  name: string;
  address?: string;
}

export type MerchantFact = FactBase<"merchant", string>;
export type PlaceFact = FactBase<"place", Place>;
export type ShipmentFact = MerchantFact | PlaceFact;

export interface Resolved<V> {
  value: V;
  confidence: Confidence;
  /** Toutes les sources qui appuient la valeur retenue. */
  sources: string[];
}

/** Précision de la preuve : sert à choisir entre des faits. */
const EVIDENCE: Record<SourceKind, number> = {
  carrier_email: 5,
  sender: 4,
  official_api: 3,
  aggregator: 2,
  nearby_email: 1,
};

/** Lisibilité du nom : un nom d'expéditeur (« Fnac ») se lit mieux qu'un libellé logistique (« FNAC LOGISTIQUE »). */
const READABILITY: Record<SourceKind, number> = {
  sender: 5,
  nearby_email: 4,
  carrier_email: 3,
  official_api: 2,
  aggregator: 1,
};

/** Mots qui ne distinguent pas un marchand d'un autre. */
const GENERIC_WORDS = new Set([
  "logistique",
  "logistics",
  "boutique",
  "ligne",
  "store",
  "shop",
  "france",
  "the",
  "les",
  "sas",
  "sarl",
  "web",
  "services",
  "service",
  "expedition",
  "expeditions",
  "entrepot",
  "warehouse",
]);

const words = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));

/** Deux noms désignent le même marchand s'ils partagent un mot distinctif (« Fnac » ≈ « FNAC LOGISTIQUE »). */
function sameMerchant(a: string, b: string): boolean {
  const other = new Set(words(b));
  return words(a).some((w) => other.has(w));
}

const best = <T>(items: readonly T[], score: (item: T) => number): T | undefined =>
  items.reduce<T | undefined>(
    (top, x) => (top === undefined || score(x) > score(top) ? x : top),
    undefined,
  );

/**
 * Marchand : un fait certain l'emporte (le plus précis). Sinon, des faits probables concordants venant de sources
 * différentes se confirment ; un fait probable isolé est gardé tel quel ; des pistes contradictoires de même
 * précision ne sont pas départagées au hasard.
 */
export function fuseMerchant(facts: readonly MerchantFact[]): Resolved<string> | undefined {
  const certain = facts.filter((f) => f.confidence === "certain");
  const pool = certain.length > 0 ? certain : facts;

  const groups: MerchantFact[][] = [];
  for (const fact of pool) {
    const group = groups.find((g) => g.some((f) => sameMerchant(f.value, fact.value)));
    if (group) group.push(fact);
    else groups.push([fact]);
  }
  const strength = (g: MerchantFact[]) =>
    new Set(g.map((f) => f.kind)).size * 10 + Math.max(...g.map((f) => EVIDENCE[f.kind]));
  const ranked = [...groups].sort((a, b) => strength(b) - strength(a));
  const [top, second] = ranked;
  if (!top || (second && strength(second) === strength(top))) return undefined;

  const confirmed = certain.length > 0 || new Set(top.map((f) => f.kind)).size > 1;
  // Un nom écrit normalement (« Caats ») se lit mieux que tout en capitales (« CAATS »).
  const shown =
    best(top, (f) => (f.value === f.value.toUpperCase() ? 0 : 10) + READABILITY[f.kind]) ?? top[0];
  if (!shown) return undefined;
  return {
    value: shown.value,
    confidence: confirmed ? "certain" : "probable",
    sources: top.map((f) => f.sourceRef),
  };
}

/** Lieu : le plus précis, puis le plus récent ; jamais un lieu inexploitable. L'adresse peut venir d'un autre fait. */
export function fusePlace(facts: readonly PlaceFact[]): Resolved<Place> | undefined {
  const usable = facts.filter((f) => isMeaningfulPlace(f.value.name));
  // Du plus récent au plus ancien : à précision égale, le premier rencontré gagne.
  const chosen = best(
    [...usable].sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? "")),
    (f) => EVIDENCE[f.kind] + (f.confidence === "certain" ? 0.5 : 0),
  );
  if (!chosen) return undefined;
  const same = usable.filter((f) => f.value.name === chosen.value.name);
  const address = chosen.value.address ?? same.find((f) => f.value.address)?.value.address;
  return {
    value: address ? { ...chosen.value, address } : chosen.value,
    confidence: chosen.confidence,
    sources: same.map((f) => f.sourceRef),
  };
}

const NAMED_PREPARATION =
  /^([^,]{3,40}),\s*(?:shipment|parcel|colis|envoi)\b[^,]{0,40}\bpr[ée]par/i;
const NAMED_SHIPPER = /\bexp[ée]diteur\s*:\s*([^,.;]{3,40})/i;

/** Expéditeur nommé dans un événement de suivi (« FNAC LOGISTIQUE, Shipment in preparation… »). */
export function shipperFromEvent(label: string): string | undefined {
  const name = (NAMED_PREPARATION.exec(label)?.[1] ?? NAMED_SHIPPER.exec(label)?.[1])?.trim();
  // Un nom sans mot distinctif (« WEB SERVICES ») désigne un service logistique, pas un marchand.
  return name && words(name).length > 0 ? name : undefined;
}
