/**
 * CLI du job de synchronisation, avec rapport lisible dans le terminal.
 * Usage : pnpm spike [--user=email] [--full] [--max=300] [--aggregator-limit=15]
 *   --user : compte à synchroniser (inutile s'il n'y en a qu'un). Sans compte ou token : consentement Google.
 *   --full : ignore l'état existant et repart de SYNC_WINDOW_DAYS jours (sinon : synchro incrémentale).
 */

import { execFile } from "node:child_process";
import { parseArgs } from "node:util";
import { config, MissingConfigError } from "./config.ts";
import { normalizeEmail } from "./email.ts";
import { authorizeOnDesktop } from "./gmail/oauth.ts";
import { runSync, SYNC_WINDOW_DAYS } from "./sync.ts";
import type { TrackingSnapshot } from "./tracking/types.ts";
import {
  listUsers,
  readRefreshToken,
  saveGrant,
  type UserProfile,
  userStateFile,
} from "./users.ts";

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

/** Compte à synchroniser : celui demandé, sinon le seul connu ; consentement Google si token absent. */
async function selectUser(requested: string | undefined): Promise<UserProfile> {
  const known = await listUsers();
  if (!requested && known.length > 1)
    throw new Error(
      `Plusieurs comptes : précise --user=… (${known.map((u) => u.email).join(", ")})`,
    );
  const email = requested && normalizeEmail(requested);
  const user = email ? known.find((u) => u.email === email) : known[0];
  const key = config.encryptionKey();
  if (user && (await readRefreshToken(user.id, key))) return user;

  const grant = await authorizeOnDesktop(config.google(), (url) => {
    print("Autorise Coly à lire Gmail (lecture seule) dans le navigateur qui s'ouvre.");
    print(`Si rien ne s'ouvre : ${url}`);
    execFile("open", [url], () => undefined);
  });
  if (email && grant.identity.email !== email)
    throw new Error(
      `Compte Google ${grant.identity.email} au lieu de ${email} : rien n'est enregistré.`,
    );
  return saveGrant(grant, key, new Date());
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      user: { type: "string" },
      full: { type: "boolean", default: false },
      max: { type: "string", default: "300" },
      "aggregator-limit": { type: "string", default: "15" },
    },
  });

  const user = await selectUser(values.user);
  const { state, newEmails, unmatchedSubjects } = await runSync({
    userId: user.id,
    full: values.full,
    max: Number(values.max),
    aggregatorLimit: Number(values["aggregator-limit"]),
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
      `• ${first?.date} ${row.merchant} — ${row.candidate.carrier} ${row.id} → ${row.status ?? "statut inconnu"}${row.placeName ? ` @ ${row.placeName}` : ""}`,
    );
    for (const snapshot of row.snapshots)
      print(`    ${snapshot.source.padEnd(8)} ${describe(snapshot)}`);
  }

  // Sujets affichés ici uniquement, pour améliorer la détection ; jamais écrits sur disque.
  print(`\n${unmatchedSubjects.length} nouveaux emails lus sans numéro détecté :`);
  for (const line of unmatchedSubjects.slice(0, 25)) print(`  ${line.slice(0, 110)}`);

  print(
    `\nÉtat de ${user.email} : ${userStateFile(user.id)} (local, hors git, sans sujet ni contenu). Appels Ship24 : ${counts.aggregatorCalls}.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof MissingConfigError ? error.message : String(error);
  process.stderr.write(`\n✗ ${message}\n`);
  process.exitCode = 1;
});
