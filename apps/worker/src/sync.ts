/**
 * Job de synchronisation : Gmail → tri sur en-têtes → détection → tracking → état dérivé.
 * Appelé à la main (CLI `pnpm spike`, bouton « Actualiser ») ; planifiable plus tard (ADR 0007).
 *
 * - Première synchro : fenêtre de SYNC_WINDOW_DAYS jours. Les colis anciens sans statut sont présumés
 *   terminés et ne consomment pas de quota de tracking.
 * - Synchros suivantes : incrémentales (seuls les nouveaux emails), et seuls les colis actifs sont re-suivis.
 * - Minimisation (ADR 0013) : l'état écrit ne contient ni sujet ni contenu d'email.
 * - Information la plus juste d'où qu'elle vienne (ADR 0015) : on garde tous les événements des sources.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type CarrierEmailInfo,
  carrierTrackingUrl,
  decideMailRead,
  detectTrackingNumbers,
  findPickupCode,
  fuseMerchant,
  fusePlace,
  fuseStatus,
  isPresumedDone,
  isTerminal,
  type MailDecision,
  normalizeEvent,
  parseCarrierEmail,
  pickupImages,
  type Resolved,
  routeFor,
  senderName,
  type TrackingCandidate,
  type UserStatus,
} from "@coly/core";
import { config } from "./config.ts";
import { merchantFacts, placeFacts, statusFacts } from "./facts.ts";
import {
  buildQuery,
  downloadImage,
  getMessage,
  getMessageHeader,
  listMessageIds,
  type MailMessage,
} from "./gmail/client.ts";
import { getAccessToken } from "./gmail/oauth.ts";
import { dataPath } from "./paths.ts";
import { trackLaPoste } from "./tracking/laposte.ts";
import { trackShip24 } from "./tracking/ship24.ts";
import type { TrackingSnapshot } from "./tracking/types.ts";

export const STATE_FILE = dataPath("state.json");
/** Images de QR / code-barres de retrait, telles qu'envoyées (une par colis). */
const PICKUP_IMAGES_DIR = dataPath("pickup");
export const SYNC_WINDOW_DAYS = 90;
const STATE_VERSION = 3;

/** Ce qui est conservé d'un email lu : aucune donnée de contenu. */
export interface Sighting {
  date: string;
  senderDomain: string;
  /** Nom affiché de l'expéditeur : celui de la boutique quand elle passe par une plateforme d'envoi. */
  senderName?: string;
  messageId: string;
}

/** Ce qu'il faut montrer au relais, trouvé dans un email (générique, tous transporteurs). */
export interface PickupProof {
  messageId: string;
  /** Réception de l'email : la preuve la plus récente l'emporte. */
  receivedAt: string;
  code?: string;
  /** Fichier de l'image dans le dossier de données, et son type. */
  image?: { file: string; mimeType: string };
}

/** Ce qu'un email transporteur apprend sur un colis (données logistiques uniquement, ADR 0013). */
export interface CarrierEmailFact {
  messageId: string;
  receivedAt: string;
  kind: CarrierEmailInfo["kind"];
  pickupPoint?: { name: string; address?: string };
  availableOn?: string;
  hasPickupQrCode: boolean;
}

export interface ShipmentState {
  id: string;
  candidate: TrackingCandidate;
  /** Marchand fusionné depuis toutes les sources (ADR 0016), recalculé à chaque synchro. */
  merchant?: Resolved<string>;
  /** Nom du marchand donné par le transporteur (ex. « Caats »), plus lisible que le domaine. */
  merchantLabel?: string;
  sightings: Sighting[];
  carrierEmails: CarrierEmailFact[];
  snapshots: TrackingSnapshot[];
  status: UserStatus | undefined;
  /** Colis ancien sans statut, présumé terminé : pas de quota dépensé (première installation). */
  presumedDone?: boolean;
  pickup?: PickupProof;
  placeName?: string;
  placeAddress?: string;
  placeLocality?: string;
  trackingUrl?: string;
  lastUpdate?: string;
}

type SkipReason = Exclude<MailDecision, { read: true }>["reason"];

export interface ColyState {
  version: number;
  updatedAt: string;
  /** Date du dernier email vu : point de départ de la synchro incrémentale suivante. */
  syncedUntil: string;
  counts: {
    matchedQuery: number;
    bodiesRead: number;
    skipped: Record<SkipReason, number>;
    aggregatorCalls: number;
    /** Emails d'expéditeurs transporteurs lus sans aucune information extraite, par domaine. */
    carrierEmailsNotUnderstood: Record<string, number>;
  };
  shipments: ShipmentState[];
  readWithoutNumber: Sighting[];
}

export interface SyncOptions {
  max: number;
  aggregatorLimit: number;
  /** Ignore l'état existant et repart de SYNC_WINDOW_DAYS jours. */
  full?: boolean;
  /** Fourni par la CLI pour ouvrir le consentement Google ; absent depuis la webapp. */
  onConsentUrl?: (url: string) => void;
}

export interface SyncResult {
  state: ColyState;
  /** Nombre d'emails nouveaux examinés lors de cette synchro. */
  newEmails: number;
  /** Sujets des emails lus sans numéro : affichables dans le terminal, jamais écrits. */
  unmatchedSubjects: string[];
}

function senderDomain(from: string): string {
  return /@([^>\s]+)/.exec(from)?.[1]?.toLowerCase() ?? "inconnu";
}

/** Statut, lieu et date de dernière info, recalculés depuis toutes les sources (ADR 0005, 0015, 0016). */
function refreshDerived(row: ShipmentState): void {
  row.status = fuseStatus(statusFacts(row))?.value;
  // Lieu : moteur de fusion (ADR 0016), l'email transporteur prime sur les API de suivi.
  const place = fusePlace(placeFacts(row));
  if (place) {
    // Adresse et ville suivent le lieu retenu : jamais celles d'un lieu précédent.
    const { name, address, locality } = place.value;
    row.placeName = name;
    if (address) row.placeAddress = address;
    else delete row.placeAddress;
    if (locality) row.placeLocality = locality;
    else delete row.placeLocality;
  }
  const lastUpdate = [
    ...row.snapshots.flatMap((s) => s.events.map((e) => e.at)),
    ...row.carrierEmails.map((e) => e.receivedAt),
  ]
    .filter((at): at is string => Boolean(at))
    .sort()
    .at(-1);
  if (lastUpdate) row.lastUpdate = lastUpdate;
}

function lastSeen(row: ShipmentState): string {
  return (
    row.sightings
      .map((s) => s.date)
      .sort()
      .at(-1) ?? ""
  );
}

/** Code et image de retrait d'un email. Au mieux : un échec de téléchargement ne bloque jamais la synchro. */
async function pickupProof(
  token: string,
  message: MailMessage,
  trackingNumber: string,
): Promise<PickupProof | undefined> {
  const proof: PickupProof = { messageId: message.id, receivedAt: message.date.toISOString() };
  const code = findPickupCode(message.text);
  if (code) proof.code = code;
  let image: Awaited<ReturnType<typeof downloadImage>>;
  for (const candidate of pickupImages(message.images)) {
    image = await downloadImage(token, message.id, candidate).catch(() => undefined);
    if (image) break;
  }
  if (image) {
    // Un fichier par email : une preuve plus ancienne lue ensuite n'écrase pas la plus récente.
    const file = `${trackingNumber}-${message.id}`.replace(/[^0-9A-Za-z-]/g, "");
    await mkdir(PICKUP_IMAGES_DIR, { recursive: true });
    await writeFile(join(PICKUP_IMAGES_DIR, file), image.bytes);
    proof.image = { file, mimeType: image.mimeType };
  }
  return proof.code || proof.image ? proof : undefined;
}

/** Les emails sont lus du plus récent au plus ancien : la preuve la plus récente prime, l'autre la complète. */
export function mergePickupProof(
  current: PickupProof | undefined,
  incoming: PickupProof,
): PickupProof {
  if (!current) return incoming;
  return incoming.receivedAt >= current.receivedAt
    ? { ...current, ...incoming }
    : { ...incoming, ...current };
}

/** Image de retrait d'un colis, telle qu'envoyée par le transporteur. */
export async function readPickupImage(
  shipment: ShipmentState,
): Promise<{ mimeType: string; bytes: Buffer } | undefined> {
  const image = shipment.pickup?.image;
  if (!image) return undefined;
  const bytes = await readFile(join(PICKUP_IMAGES_DIR, image.file)).catch(() => undefined);
  return bytes && { mimeType: image.mimeType, bytes };
}

/** Colis par son numéro (identifiant d'URL décodé). */
export async function findShipment(id: string): Promise<ShipmentState | undefined> {
  return (await readState())?.shipments.find((s) => s.id === id);
}

export async function readState(): Promise<ColyState | undefined> {
  try {
    const state = JSON.parse(await readFile(STATE_FILE, "utf8")) as ColyState;
    if (state.version !== STATE_VERSION) return undefined;
    // Snapshots stockés avant la normalisation des événements : même traitement qu'à la lecture de la source.
    for (const shipment of state.shipments)
      for (const snapshot of shipment.snapshots) {
        snapshot.events = snapshot.events.map(normalizeEvent);
        if (snapshot.events[0]) snapshot.lastEvent = snapshot.events[0];
      }
    return state;
  } catch {
    return undefined;
  }
}

export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const now = new Date();
  const previous = options.full ? undefined : await readState();
  const token = await getAccessToken(config.google(), config.encryptionKey(), options.onConsentUrl);
  const query = buildQuery(
    previous
      ? { days: SYNC_WINDOW_DAYS, since: new Date(previous.syncedUntil) }
      : { days: SYNC_WINDOW_DAYS },
  );
  const ids = await listMessageIds(token, query, options.max);
  const knownMessages = new Set([
    ...(previous?.shipments.flatMap((s) => s.sightings.map((x) => x.messageId)) ?? []),
    ...(previous?.readWithoutNumber.map((x) => x.messageId) ?? []),
  ]);

  const counts: ColyState["counts"] = {
    matchedQuery: (previous?.counts.matchedQuery ?? 0) + ids.length,
    bodiesRead: previous?.counts.bodiesRead ?? 0,
    skipped: {
      marketing: previous?.counts.skipped.marketing ?? 0,
      feedback: previous?.counts.skipped.feedback ?? 0,
      not_transactional: previous?.counts.skipped.not_transactional ?? 0,
    },
    aggregatorCalls: 0,
    carrierEmailsNotUnderstood: { ...previous?.counts.carrierEmailsNotUnderstood },
  };
  const rows = new Map<string, ShipmentState>(previous?.shipments.map((s) => [s.id, s]));
  const readWithoutNumber: Sighting[] = [...(previous?.readWithoutNumber ?? [])];
  const unmatchedSubjects: string[] = [];
  let syncedUntil =
    previous?.syncedUntil ?? new Date(now.getTime() - SYNC_WINDOW_DAYS * 86_400_000).toISOString();

  for (const id of ids) {
    if (knownMessages.has(id)) continue;
    const header = await getMessageHeader(token, id);
    if (header.date.toISOString() > syncedUntil) syncedUntil = header.date.toISOString();
    const decision = decideMailRead(header);
    if (!decision.read) {
      counts.skipped[decision.reason]++;
      continue;
    }
    const message = await getMessage(token, id);
    counts.bodiesRead++;
    const sighting: Sighting = {
      date: message.date.toISOString().slice(0, 10),
      senderDomain: senderDomain(message.from),
      messageId: message.id,
    };
    const name = senderName(message.from);
    if (name) sighting.senderName = name;
    const candidates = detectTrackingNumbers(message.text, message.urls);
    const carrierEmail = parseCarrierEmail({
      from: message.from,
      subject: header.subject,
      text: message.text,
    });
    if (decision.reason === "carrier_sender" && !carrierEmail && candidates.length === 0) {
      const domain = senderDomain(message.from);
      counts.carrierEmailsNotUnderstood[domain] =
        (counts.carrierEmailsNotUnderstood[domain] ?? 0) + 1;
    }
    if (carrierEmail && !candidates.some((c) => c.trackingNumber === carrierEmail.trackingNumber))
      candidates.push({
        carrier: carrierEmail.carrier,
        trackingNumber: carrierEmail.trackingNumber,
        via: "carrier_email",
      });
    // Code ou QR de retrait : rattaché seulement quand l'email ne parle que d'un colis, sinon on ne sait pas lequel.
    const proof =
      candidates.length === 1 && candidates[0]
        ? await pickupProof(token, message, candidates[0].trackingNumber)
        : undefined;
    // Le contenu de l'email n'est plus référencé au-delà de ce point.
    if (candidates.length === 0) {
      readWithoutNumber.push(sighting);
      unmatchedSubjects.push(`${sighting.date} ${sighting.senderDomain} — ${header.subject}`);
    }
    for (const candidate of candidates) {
      const row = rows.get(candidate.trackingNumber) ?? {
        id: candidate.trackingNumber,
        candidate,
        sightings: [],
        carrierEmails: [],
        snapshots: [],
        status: undefined,
      };
      row.sightings.push(sighting);
      if (proof) row.pickup = mergePickupProof(row.pickup, proof);
      if (carrierEmail?.trackingNumber === candidate.trackingNumber) {
        const fact: CarrierEmailFact = {
          messageId: message.id,
          receivedAt: message.date.toISOString(),
          kind: carrierEmail.kind,
          hasPickupQrCode: carrierEmail.hasPickupQrCode,
        };
        if (carrierEmail.pickupPoint) fact.pickupPoint = carrierEmail.pickupPoint;
        if (carrierEmail.availableOn) fact.availableOn = carrierEmail.availableOn;
        row.carrierEmails.push(fact);
        if (carrierEmail.merchant) row.merchantLabel = carrierEmail.merchant;
      }
      // Un nouvel email sur un colis le réveille, même s'il était présumé terminé.
      delete row.presumedDone;
      rows.set(candidate.trackingNumber, row);
    }
  }

  const laposteKey = config.laposteKey();
  const aggregatorKey = config.aggregatorKey();
  // Les plus récents d'abord : c'est là que le quota de tracking a le plus de valeur.
  const byRecency = [...rows.values()].sort((a, b) => lastSeen(b).localeCompare(lastSeen(a)));
  for (const row of byRecency) {
    const url = carrierTrackingUrl(row.candidate.carrier, row.id);
    if (url) row.trackingUrl = url;
    if (isTerminal(row.status)) continue;
    if (row.presumedDone || isPresumedDone(lastSeen(row), row.status !== undefined, now)) {
      row.presumedDone = true;
      continue;
    }

    const route = routeFor(row.candidate.carrier);
    const snapshots: TrackingSnapshot[] = [];
    if (route === "laposte" && laposteKey) snapshots.push(await trackLaPoste(laposteKey, row.id));
    const laposteFound = snapshots.some((s) => s.found);
    // Ship24 : tout ce que La Poste ne couvre pas, dans la limite du quota gratuit.
    if (
      route !== "none" &&
      !laposteFound &&
      aggregatorKey &&
      counts.aggregatorCalls < options.aggregatorLimit
    ) {
      counts.aggregatorCalls++;
      snapshots.push(await trackShip24(aggregatorKey, row.id));
    }
    if (snapshots.length > 0) row.snapshots = snapshots;
    refreshDerived(row);
  }
  // Marchand : pour tous les colis, terminés compris, car un email sans numéro reçu depuis peut le révéler.
  for (const row of byRecency) {
    const merchant = fuseMerchant(merchantFacts(row, readWithoutNumber));
    if (merchant) row.merchant = merchant;
    else delete row.merchant;
  }

  const state: ColyState = {
    version: STATE_VERSION,
    updatedAt: now.toISOString(),
    syncedUntil,
    counts,
    shipments: byRecency,
    readWithoutNumber,
  };
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  return { state, newEmails: ids.filter((id) => !knownMessages.has(id)).length, unmatchedSubjects };
}
