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
import { dirname } from "node:path";
import {
  type CarrierEmailInfo,
  carrierTrackingUrl,
  decideMailRead,
  deriveStatus,
  detectTrackingNumbers,
  fromLaPosteCode,
  fromShip24Milestone,
  isMeaningfulPlace,
  isPresumedDone,
  type MailDecision,
  parseCarrierEmail,
  routeFor,
  type StatusObservation,
  type TrackingCandidate,
  type UserStatus,
} from "@coly/core";
import { config } from "./config.ts";
import { buildQuery, getMessage, getMessageHeader, listMessageIds } from "./gmail/client.ts";
import { getAccessToken } from "./gmail/oauth.ts";
import { dataPath } from "./paths.ts";
import { trackLaPoste } from "./tracking/laposte.ts";
import { trackShip24 } from "./tracking/ship24.ts";
import type { TrackingSnapshot } from "./tracking/types.ts";

export const STATE_FILE = dataPath("state.json");
export const SYNC_WINDOW_DAYS = 90;
const STATE_VERSION = 3;
const TERMINAL: ReadonlySet<UserStatus> = new Set(["delivered", "picked_up", "returned"]);

/** Ce qui est conservé d'un email lu : aucune donnée de contenu. */
export interface Sighting {
  date: string;
  senderDomain: string;
  messageId: string;
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
  merchant: string;
  /** Nom du marchand donné par le transporteur (ex. « Caats »), plus lisible que le domaine. */
  merchantLabel?: string;
  sightings: Sighting[];
  carrierEmails: CarrierEmailFact[];
  snapshots: TrackingSnapshot[];
  status: UserStatus | undefined;
  /** Colis ancien sans statut, présumé terminé : pas de quota dépensé (première installation). */
  presumedDone?: boolean;
  placeName?: string;
  placeAddress?: string;
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

function observations(snapshots: readonly TrackingSnapshot[]): StatusObservation[] {
  return snapshots.flatMap((s) => {
    const status =
      s.source === "laposte"
        ? fromLaPosteCode(s.lastEvent?.code)
        : fromShip24Milestone(s.sourceStatus);
    if (!status) return [];
    const observation: StatusObservation = { source: s.source, status };
    if (s.lastEvent?.at) observation.at = s.lastEvent.at;
    return [observation];
  });
}

function placeName(snapshots: readonly TrackingSnapshot[]): string | undefined {
  for (const s of snapshots)
    if (isMeaningfulPlace(s.removalPoint?.name)) return s.removalPoint?.name;
  for (const s of snapshots) {
    const pickup = s.events.find((e) =>
      /pickup|relais|retrait|parcelshop|point/i.test(e.code ?? e.label),
    );
    if (isMeaningfulPlace(pickup?.location)) return pickup?.location;
  }
  return undefined;
}

function emailObservations(row: ShipmentState): StatusObservation[] {
  return row.carrierEmails.map((e) => ({ source: "email", status: e.kind, at: e.receivedAt }));
}

/** Statut, lieu et date de dernière info, recalculés depuis toutes les sources (ADR 0005, 0015). */
function refreshDerived(row: ShipmentState): void {
  row.status = deriveStatus([...observations(row.snapshots), ...emailObservations(row)]);
  // L'email transporteur donne le relais exact (nom + adresse) : il prime sur l'agrégateur.
  const emailPlace = row.carrierEmails.findLast((e) => e.pickupPoint)?.pickupPoint;
  if (emailPlace) {
    row.placeName = emailPlace.name;
    if (emailPlace.address) row.placeAddress = emailPlace.address;
  } else {
    const place = placeName(row.snapshots);
    if (place) row.placeName = place;
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

export async function readState(): Promise<ColyState | undefined> {
  try {
    const state = JSON.parse(await readFile(STATE_FILE, "utf8")) as ColyState;
    return state.version === STATE_VERSION ? state : undefined;
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
    // Le contenu de l'email n'est plus référencé au-delà de ce point.
    if (candidates.length === 0) {
      readWithoutNumber.push(sighting);
      unmatchedSubjects.push(`${sighting.date} ${sighting.senderDomain} — ${header.subject}`);
    }
    for (const candidate of candidates) {
      const row = rows.get(candidate.trackingNumber) ?? {
        id: candidate.trackingNumber,
        candidate,
        merchant: sighting.senderDomain,
        sightings: [],
        carrierEmails: [],
        snapshots: [],
        status: undefined,
      };
      row.sightings.push(sighting);
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
    if (row.status && TERMINAL.has(row.status)) continue;
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
