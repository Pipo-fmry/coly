/**
 * Détection des numéros de suivi dans un email (texte + liens).
 * Déterministe, sans I/O. Ordre de confiance : lien d'un transporteur connu > motif spécifique > motif + mot-clé.
 * Les formats sont indicatifs (investigation §5.1) : un numéro n'est confirmé que par une requête de tracking réussie.
 */

export type DetectedCarrier =
  | "laposte" // S10 international « …FR » : Colissimo ou Chronopost, l'API La Poste tranche
  | "colissimo"
  | "chronopost"
  | "dpd"
  | "mondial_relay"
  | "colis_prive"
  | "gls"
  | "ups"
  | "dhl"
  | "fedex"
  | "amazon_logistics"
  | "unknown";

export interface TrackingCandidate {
  carrier: DetectedCarrier;
  trackingNumber: string;
  via: "link" | "pattern";
}

interface LinkRule {
  carrier: DetectedCarrier;
  host: RegExp;
  params: string[];
  path?: RegExp;
}

const LINK_RULES: LinkRule[] = [
  { carrier: "laposte", host: /(^|\.)laposte\.fr$/, params: ["code", "codes"] },
  {
    carrier: "colissimo",
    host: /(^|\.)colissimo\.(fr|entreprise\.laposte\.fr)$/,
    params: ["parcelnumber", "code"],
  },
  {
    carrier: "chronopost",
    host: /(^|\.)chronopost\.fr$/,
    params: ["listeNumerosLT", "listeNumeros", "numero"],
  },
  {
    carrier: "dpd",
    host: /(^|\.)dpd\.(fr|com)$/,
    params: ["exa", "parcelNumber", "query"],
    path: /\b(\d{14})\b/,
  },
  {
    carrier: "mondial_relay",
    host: /(^|\.)mondialrelay\.(fr|com|be|es)$/,
    params: ["numeroExpedition", "NumeroExpedition"],
  },
  { carrier: "colis_prive", host: /(^|\.)colisprive\.(fr|com)$/, params: ["numColis", "colisID"] },
  { carrier: "gls", host: /(^|\.)gls-(group\.(eu|com)|france\.com)$/, params: ["match"] },
  { carrier: "ups", host: /(^|\.)ups\.com$/, params: ["tracknum", "InquiryNumber1"] },
  { carrier: "dhl", host: /(^|\.)dhl\.(com|fr|de)$/, params: ["tracking-id", "AWB", "piececode"] },
  { carrier: "fedex", host: /(^|\.)fedex\.com$/, params: ["trknbr", "tracknumbers"] },
];

interface PatternRule {
  carrier: DetectedCarrier;
  pattern: RegExp;
  /** Mot-clé exigé dans le texte pour accepter un motif trop générique. */
  requires?: RegExp;
}

const PATTERN_RULES: PatternRule[] = [
  { carrier: "ups", pattern: /\b1Z[0-9A-Z]{16}\b/g },
  { carrier: "laposte", pattern: /\b[A-Z]{2}\d{9}FR\b/g },
  { carrier: "colissimo", pattern: /\b\d[A-Z]\d{11}\b/g },
  { carrier: "amazon_logistics", pattern: /\bTBA\d{12}\b/g },
  { carrier: "dpd", pattern: /\b\d{14}\b/g, requires: /\bdpd\b/i },
];

const TRACKING_LIKE = /^[0-9A-Z]{8,30}$/;

function normalize(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function fromLink(url: string): TrackingCandidate[] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }
  const rule = LINK_RULES.find((r) => r.host.test(parsed.hostname));
  if (!rule) return [];

  const values = rule.params.flatMap((p) => (parsed.searchParams.get(p) ?? "").split(/[,;]/));
  const pathMatch = rule.path?.exec(parsed.pathname)?.[1];
  if (pathMatch) values.push(pathMatch);

  return values
    .map(normalize)
    .filter((v) => TRACKING_LIKE.test(v))
    .map((trackingNumber) => ({ carrier: rule.carrier, trackingNumber, via: "link" as const }));
}

function fromText(text: string): TrackingCandidate[] {
  return PATTERN_RULES.flatMap((rule) => {
    if (rule.requires && !rule.requires.test(text)) return [];
    return [...text.matchAll(rule.pattern)].map((m) => ({
      carrier: rule.carrier,
      trackingNumber: normalize(m[0]),
      via: "pattern" as const,
    }));
  });
}

/** Candidats dédoublonnés par numéro ; un candidat issu d'un lien l'emporte sur un motif. */
export function detectTrackingNumbers(text: string, urls: readonly string[]): TrackingCandidate[] {
  const byNumber = new Map<string, TrackingCandidate>();
  for (const candidate of [...urls.flatMap(fromLink), ...fromText(text)]) {
    if (!byNumber.has(candidate.trackingNumber)) byNumber.set(candidate.trackingNumber, candidate);
  }
  return [...byNumber.values()];
}

export type TrackingRoute = "laposte" | "aggregator" | "none";

/** Où interroger le statut (ADR 0004). Amazon Logistics n'a pas d'API : le statut vient des emails. */
export function routeFor(carrier: DetectedCarrier): TrackingRoute {
  if (carrier === "laposte" || carrier === "colissimo" || carrier === "chronopost")
    return "laposte";
  if (carrier === "amazon_logistics") return "none";
  return "aggregator";
}
