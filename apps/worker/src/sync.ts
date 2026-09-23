/**
 * Job de synchronisation : Gmail → tri sur en-têtes → détection → tracking → état dérivé.
 * Appelé à la main (CLI `pnpm spike`, bouton « Actualiser » de la webapp) ; planifiable plus tard (ADR 0007).
 * Minimisation (ADR 0013) : l'état écrit ne contient ni sujet ni contenu d'email.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  decideMailRead,
  deriveStatus,
  detectTrackingNumbers,
  fromLaPosteCode,
  fromShip24Milestone,
  type MailDecision,
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

/** Ce qui est conservé d'un email lu : aucune donnée de contenu. */
export interface Sighting {
  date: string;
  senderDomain: string;
  messageId: string;
}

export interface ShipmentState {
  id: string;
  candidate: TrackingCandidate;
  merchant: string;
  sightings: Sighting[];
  snapshots: TrackingSnapshot[];
  status: UserStatus | undefined;
  placeName?: string;
  lastUpdate?: string;
}

export interface ColyState {
  updatedAt: string;
  counts: {
    matchedQuery: number;
    bodiesRead: number;
    skipped: Record<Exclude<MailDecision, { read: true }>["reason"], number>;
    aggregatorCalls: number;
  };
  shipments: ShipmentState[];
  readWithoutNumber: Sighting[];
}

export interface SyncOptions {
  days: number;
  max: number;
  aggregatorLimit: number;
  /** Fourni par la CLI pour ouvrir le consentement Google ; absent depuis la webapp. */
  onConsentUrl?: (url: string) => void;
}

export interface SyncResult {
  state: ColyState;
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
  for (const s of snapshots) if (s.removalPoint?.name) return s.removalPoint.name;
  for (const s of snapshots)
    if (s.sourceStatus === "available_for_pickup") return s.lastEvent?.location;
  return undefined;
}

export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const token = await getAccessToken(config.google(), config.encryptionKey(), options.onConsentUrl);
  const ids = await listMessageIds(token, buildQuery(options.days), options.max);

  const counts: ColyState["counts"] = {
    matchedQuery: ids.length,
    bodiesRead: 0,
    skipped: { marketing: 0, not_transactional: 0 },
    aggregatorCalls: 0,
  };
  const rows = new Map<string, ShipmentState>();
  const readWithoutNumber: Sighting[] = [];
  const unmatchedSubjects: string[] = [];

  for (const id of ids) {
    const header = await getMessageHeader(token, id);
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
        snapshots: [],
        status: undefined,
      };
      row.sightings.push(sighting);
      rows.set(candidate.trackingNumber, row);
    }
  }

  const laposteKey = config.laposteKey();
  const aggregatorKey = config.aggregatorKey();
  for (const row of rows.values()) {
    const route = routeFor(row.candidate.carrier);
    if (route === "laposte" && laposteKey)
      row.snapshots.push(await trackLaPoste(laposteKey, row.id));
    // Ship24 aussi sur le groupe La Poste, pour comparer les sources (dans la limite du quota gratuit).
    if (route !== "none" && aggregatorKey && counts.aggregatorCalls < options.aggregatorLimit) {
      counts.aggregatorCalls++;
      row.snapshots.push(await trackShip24(aggregatorKey, row.id));
    }
    row.status = deriveStatus(observations(row.snapshots));
    const place = placeName(row.snapshots);
    if (place) row.placeName = place;
    const lastUpdate = row.snapshots
      .map((s) => s.lastEvent?.at)
      .filter((at): at is string => Boolean(at))
      .sort()
      .at(-1);
    if (lastUpdate) row.lastUpdate = lastUpdate;
  }

  const state: ColyState = {
    updatedAt: new Date().toISOString(),
    counts,
    shipments: [...rows.values()].sort((a, b) =>
      (b.sightings[0]?.date ?? "").localeCompare(a.sightings[0]?.date ?? ""),
    ),
    readWithoutNumber,
  };
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  return { state, unmatchedSubjects };
}

export async function readState(): Promise<ColyState | undefined> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as ColyState;
  } catch {
    return undefined;
  }
}
