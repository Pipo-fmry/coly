/**
 * `pnpm coverage` : affiche le rapport de couverture et l'ajoute à l'historique local (data/coverage-history.jsonl).
 */

import { appendFile } from "node:fs/promises";
import { type CoverageRow, computeCoverage, type Ratio } from "./coverage.ts";
import { readGroundTruth } from "./ground-truth.ts";
import { dataPath } from "./paths.ts";
import { readState } from "./sync.ts";

const print = (line = "") => process.stdout.write(`${line}\n`);
const pct = ({ hits, total }: Ratio) =>
  total === 0
    ? "   —   "
    : `${String(Math.round((hits / total) * 100)).padStart(3)} % (${hits}/${total})`;

function line(label: string, r: CoverageRow): string {
  const fresh = r.medianFreshnessHours === null ? "—" : `${Math.round(r.medianFreshnessHours)} h`;
  return [
    label.padEnd(16),
    String(r.active).padStart(6),
    pct(r.merchant).padEnd(16),
    pct(r.statusKnown).padEnd(16),
    pct(r.statusCorrect).padEnd(16),
    fresh.padStart(8),
    String(r.pickup.total).padStart(8),
    pct(r.pickup.place).padEnd(16),
    pct(r.pickup.address).padEnd(16),
    pct(r.pickup.deadline).padEnd(16),
    pct(r.pickup.codeOrQr),
  ].join("  ");
}

const state = await readState();
if (!state) {
  process.stderr.write("Aucun état : lance d'abord `pnpm spike`.\n");
  process.exit(1);
}
const report = computeCoverage(state, await readGroundTruth(), new Date());

print(
  `Couverture au ${report.generatedAt.slice(0, 16).replace("T", " ")} — colis actifs uniquement`,
);
print(`(${report.presumedDone} colis anciens présumés terminés exclus)\n`);
print(
  [
    "Transporteur".padEnd(16),
    "Actifs".padStart(6),
    "Marchand".padEnd(16),
    "Statut connu".padEnd(16),
    "Statut juste".padEnd(16),
    "Fraîch.".padStart(8),
    "À retirer".padStart(8),
    "Lieu".padEnd(16),
    "Adresse".padEnd(16),
    "Date limite".padEnd(16),
    "Code / QR",
  ].join("  "),
);
print(line("TOTAL", report.global));
for (const [carrier, row] of Object.entries(report.byCarrier).sort()) print(line(carrier, row));

const notUnderstood = Object.entries(report.carrierEmailsNotUnderstood);
print(
  `\nEmails transporteurs non compris : ${notUnderstood.length === 0 ? "aucun" : notUnderstood.map(([d, n]) => `${d} ×${n}`).join(", ")}`,
);
if (report.global.statusCorrect.total === 0)
  print(
    "Statut juste : aucune vérification encore — utilise « Ce statut est-il juste ? » dans l'app.",
  );

await appendFile(dataPath("coverage-history.jsonl"), `${JSON.stringify(report)}\n`, {
  mode: 0o600,
});
