/**
 * Spike : Gmail → tri sur en-têtes → détection des colis → La Poste / Ship24 → rapport comparatif.
 * Usage : pnpm spike [--days=60] [--max=300] [--aggregator-limit=15]
 * Rien n'est planifié : on relance la commande pour actualiser (ADR 0007).
 * Minimisation (ADR 0013) : on lit le contenu d'un email seulement si ses en-têtes le justifient,
 * et le rapport écrit sur disque ne contient ni sujet ni contenu, seulement des champs utiles.
 */

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  decideMailRead,
  detectTrackingNumbers,
  type MailDecision,
  routeFor,
  type TrackingCandidate,
} from "@coly/core";
import { config, MissingConfigError } from "./config.ts";
import { buildQuery, getMessage, getMessageHeader, listMessageIds } from "./gmail/client.ts";
import { getAccessToken } from "./gmail/oauth.ts";
import { trackLaPoste } from "./tracking/laposte.ts";
import { trackShip24 } from "./tracking/ship24.ts";
import type { TrackingSnapshot } from "./tracking/types.ts";

const print = (line = "") => process.stdout.write(`${line}\n`);

/** Ce qui est conservé d'un email lu : aucune donnée de contenu. */
interface Sighting {
  date: string;
  senderDomain: string;
  messageId: string;
}

interface Row {
  candidate: TrackingCandidate;
  sightings: Sighting[];
  snapshots: TrackingSnapshot[];
}

function senderDomain(from: string): string {
  return /@([^>\s]+)/.exec(from)?.[1]?.toLowerCase() ?? "inconnu";
}

function describe(snapshot: TrackingSnapshot): string {
  if (snapshot.error) return `erreur ${snapshot.error}`;
  if (!snapshot.found) return "introuvable";
  const parts = [
    snapshot.sourceStatus,
    snapshot.lastEvent?.label,
    snapshot.lastEvent?.at?.slice(0, 16),
  ];
  if (snapshot.carrierSeen) parts.push(`[${snapshot.carrierSeen}]`);
  if (snapshot.partner)
    parts.push(`partenaire ${snapshot.partner.name ?? ""} ${snapshot.partner.reference ?? ""}`);
  if (snapshot.removalPoint) parts.push(`retrait : ${snapshot.removalPoint.name ?? ""}`);
  if (snapshot.relatedNumbers.length > 0)
    parts.push(`liés : ${snapshot.relatedNumbers.join(", ")}`);
  return parts.filter(Boolean).join(" · ");
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      days: { type: "string", default: "60" },
      max: { type: "string", default: "300" },
      "aggregator-limit": { type: "string", default: "15" },
    },
  });
  const days = Number(values.days);
  const aggregatorLimit = Number(values["aggregator-limit"]);

  const token = await getAccessToken(config.google(), config.encryptionKey(), (url) => {
    print("Autorise Coly à lire Gmail (lecture seule) dans le navigateur qui s'ouvre.");
    print(`Si rien ne s'ouvre : ${url}`);
    execFile("open", [url], () => undefined);
  });

  const query = buildQuery(days);
  const ids = await listMessageIds(token, query, Number(values.max));

  const skipped: Record<Exclude<MailDecision, { read: true }>["reason"], number> = {
    marketing: 0,
    not_transactional: 0,
  };
  const rows = new Map<string, Row>();
  const readWithoutNumber: { sighting: Sighting; subject: string }[] = [];
  let bodiesRead = 0;

  for (const id of ids) {
    const header = await getMessageHeader(token, id);
    const decision = decideMailRead(header);
    if (!decision.read) {
      skipped[decision.reason]++;
      continue;
    }
    const message = await getMessage(token, id);
    bodiesRead++;
    const sighting: Sighting = {
      date: message.date.toISOString().slice(0, 10),
      senderDomain: senderDomain(message.from),
      messageId: message.id,
    };
    const candidates = detectTrackingNumbers(message.text, message.urls);
    // Le contenu de l'email n'est plus référencé au-delà de ce point.
    if (candidates.length === 0) readWithoutNumber.push({ sighting, subject: header.subject });
    for (const candidate of candidates) {
      const row = rows.get(candidate.trackingNumber) ?? {
        candidate,
        sightings: [],
        snapshots: [],
      };
      row.sightings.push(sighting);
      rows.set(candidate.trackingNumber, row);
    }
  }

  print(`\nGmail : ${ids.length} emails passent le filtre serveur (${days} derniers jours).`);
  print(
    `Contenu lu : ${bodiesRead} · écartés sur en-têtes : ${skipped.marketing} marketing, ${skipped.not_transactional} non transactionnels.`,
  );

  const laposteKey = config.laposteKey();
  const aggregatorKey = config.aggregatorKey();
  let aggregatorCalls = 0;
  for (const row of rows.values()) {
    const route = routeFor(row.candidate.carrier);
    if (route === "laposte" && laposteKey) {
      row.snapshots.push(await trackLaPoste(laposteKey, row.candidate.trackingNumber));
    }
    // Ship24 aussi sur le groupe La Poste, pour comparer les sources (dans la limite du quota gratuit).
    if (route !== "none" && aggregatorKey && aggregatorCalls < aggregatorLimit) {
      aggregatorCalls++;
      row.snapshots.push(await trackShip24(aggregatorKey, row.candidate.trackingNumber));
    }
  }

  const sorted = [...rows.values()].sort((a, b) =>
    (b.sightings[0]?.date ?? "").localeCompare(a.sightings[0]?.date ?? ""),
  );
  print(`\n${sorted.length} numéros de suivi détectés :\n`);
  for (const row of sorted) {
    const first = row.sightings[0];
    print(
      `• ${first?.date} ${first?.senderDomain} — ${row.candidate.carrier} ${row.candidate.trackingNumber} (${row.candidate.via}, ${row.sightings.length} email(s))`,
    );
    for (const snapshot of row.snapshots)
      print(`    ${snapshot.source.padEnd(8)} ${describe(snapshot)}`);
    if (row.snapshots.length === 0) {
      const none = routeFor(row.candidate.carrier) === "none";
      print(
        `    ${none ? "pas d'API (statut via emails)" : "non interrogé (clé absente ou quota)"}`,
      );
    }
  }

  // Sujets affichés dans le terminal uniquement, pour améliorer la détection ; jamais écrits sur disque.
  print(`\n${readWithoutNumber.length} emails lus sans numéro détecté :`);
  for (const { sighting, subject } of readWithoutNumber.slice(0, 25))
    print(`  ${sighting.date} ${sighting.senderDomain} — ${subject.slice(0, 80)}`);

  await mkdir("data", { recursive: true });
  const reportPath = `data/spike-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  const report = {
    counts: { matchedQuery: ids.length, bodiesRead, skipped },
    rows: sorted,
    readWithoutNumber: readWithoutNumber.map((r) => r.sighting),
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  print(
    `\nRapport : ${reportPath} (local, hors git, sans sujet ni contenu). Appels Ship24 : ${aggregatorCalls}.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof MissingConfigError ? error.message : String(error);
  process.stderr.write(`\n✗ ${message}\n`);
  process.exitCode = 1;
});
