/**
 * CLI du job de synchronisation, avec rapport lisible dans le terminal.
 * Usage : pnpm spike [--full] [--max=300] [--aggregator-limit=15]
 *   --full : ignore l'état existant et repart de SYNC_WINDOW_DAYS jours (sinon : synchro incrémentale).
 */

import { execFile } from "node:child_process";
import { parseArgs } from "node:util";
import { MissingConfigError } from "./config.ts";
import { runSync, STATE_FILE, SYNC_WINDOW_DAYS } from "./sync.ts";
import type { TrackingSnapshot } from "./tracking/types.ts";

const print = (line = "") => process.stdout.write(`${line}\n`);

function describe(snapshot: TrackingSnapshot): string {
  if (snapshot.error) return `erreur ${snapshot.error}`;
  if (!snapshot.found) return "introuvable";
  const parts = [
    snapshot.sourceStatus,
    snapshot.lastEvent?.label,
    snapshot.lastEvent?.at?.slice(0, 16),
    `${snapshot.events.length} événements`,
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
      full: { type: "boolean", default: false },
      max: { type: "string", default: "300" },
      "aggregator-limit": { type: "string", default: "15" },
    },
  });

  const { state, newEmails, unmatchedSubjects } = await runSync({
    full: values.full,
    max: Number(values.max),
    aggregatorLimit: Number(values["aggregator-limit"]),
    onConsentUrl: (url) => {
      print("Autorise Coly à lire Gmail (lecture seule) dans le navigateur qui s'ouvre.");
      print(`Si rien ne s'ouvre : ${url}`);
      execFile("open", [url], () => undefined);
    },
  });

  const { counts } = state;
  print(
    `\n${newEmails} nouveaux emails examinés (${values.full ? `${SYNC_WINDOW_DAYS} derniers jours` : "depuis la dernière synchro"}).`,
  );
  print(
    `Au total : ${counts.bodiesRead} lus · écartés sans ouverture : ${counts.skipped.marketing} marketing, ${counts.skipped.feedback} avis, ${counts.skipped.not_transactional} autres.`,
  );

  const presumed = state.shipments.filter((s) => s.presumedDone).length;
  print(
    `\n${state.shipments.length} colis, dont ${presumed} anciens présumés terminés (non suivis) :\n`,
  );
  for (const row of state.shipments.filter((s) => !s.presumedDone)) {
    const first = row.sightings[0];
    print(
      `• ${first?.date} ${row.merchant?.value ?? "marchand inconnu"} — ${row.candidate.carrier} ${row.id} → ${row.status ?? "statut inconnu"}${row.placeName ? ` @ ${row.placeName}` : ""}`,
    );
    for (const snapshot of row.snapshots)
      print(`    ${snapshot.source.padEnd(8)} ${describe(snapshot)}`);
  }

  // Sujets affichés ici uniquement, pour améliorer la détection ; jamais écrits sur disque.
  print(`\n${unmatchedSubjects.length} nouveaux emails lus sans numéro détecté :`);
  for (const line of unmatchedSubjects.slice(0, 25)) print(`  ${line.slice(0, 110)}`);

  print(
    `\nÉtat : ${STATE_FILE} (local, hors git, sans sujet ni contenu). Appels Ship24 : ${counts.aggregatorCalls}.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof MissingConfigError ? error.message : String(error);
  process.stderr.write(`\n✗ ${message}\n`);
  process.exitCode = 1;
});
