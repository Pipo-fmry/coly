/**
 * Spike : Gmail → détection des colis → La Poste / Ship24 → rapport comparatif.
 * Usage : pnpm --filter @coly/worker spike [--days=60] [--max=300] [--aggregator-limit=15]
 * Rien n'est planifié : on relance la commande pour actualiser (ADR 0007).
 * Seuls des champs extraits sont écrits dans data/ (ignoré par git), jamais le corps des emails (ADR 0006).
 */

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { detectTrackingNumbers, routeFor, type TrackingCandidate } from "@coly/core";
import { config, MissingConfigError } from "./config.ts";
import { buildQuery, getMessage, listMessageIds } from "./gmail/client.ts";
import { getAccessToken } from "./gmail/oauth.ts";
import { trackLaPoste } from "./tracking/laposte.ts";
import { trackShip24 } from "./tracking/ship24.ts";
import type { TrackingSnapshot } from "./tracking/types.ts";

const print = (line = "") => process.stdout.write(`${line}\n`);

interface Sighting {
  date: string;
  sender: string;
  subject: string;
  messageId: string;
}

interface Row {
  candidate: TrackingCandidate;
  sightings: Sighting[];
  snapshots: TrackingSnapshot[];
}

function senderDomain(from: string): string {
  return /@([^>\s]+)/.exec(from)?.[1]?.toLowerCase() ?? from;
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
  print(`\n${ids.length} emails correspondent au filtre (${days} derniers jours).`);

  const rows = new Map<string, Row>();
  const unmatched: Sighting[] = [];
  for (const id of ids) {
    const message = await getMessage(token, id);
    const sighting: Sighting = {
      date: message.date.toISOString().slice(0, 10),
      sender: senderDomain(message.from),
      subject: message.subject,
      messageId: message.id,
    };
    const candidates = detectTrackingNumbers(message.text, message.urls);
    if (candidates.length === 0) unmatched.push(sighting);
    for (const candidate of candidates) {
      const row = rows.get(candidate.trackingNumber) ?? { candidate, sightings: [], snapshots: [] };
      row.sightings.push(sighting);
      rows.set(candidate.trackingNumber, row);
    }
  }

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
      `• ${first?.date} ${first?.sender} — ${row.candidate.carrier} ${row.candidate.trackingNumber} (${row.candidate.via}, ${row.sightings.length} email(s))`,
    );
    print(`    ${first?.subject.slice(0, 90)}`);
    for (const snapshot of row.snapshots)
      print(`    ${snapshot.source.padEnd(8)} ${describe(snapshot)}`);
    if (row.snapshots.length === 0)
      print(
        `    ${routeFor(row.candidate.carrier) === "none" ? "pas d'API (statut via emails)" : "non interrogé (clé absente ou quota)"}`,
      );
  }

  print(
    `\n${unmatched.length} emails filtrés sans numéro détecté (à examiner pour améliorer la détection) :`,
  );
  for (const s of unmatched.slice(0, 25))
    print(`  ${s.date} ${s.sender} — ${s.subject.slice(0, 80)}`);

  await mkdir("data", { recursive: true });
  const reportPath = `data/spike-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  await writeFile(reportPath, JSON.stringify({ query, rows: sorted, unmatched }, null, 2), {
    mode: 0o600,
  });
  print(`\nRapport complet : ${reportPath} (local, hors git). Appels Ship24 : ${aggregatorCalls}.`);
}

main().catch((error: unknown) => {
  const message = error instanceof MissingConfigError ? error.message : String(error);
  process.stderr.write(`\n✗ ${message}\n`);
  process.exitCode = 1;
});
