/**
 * Vérité de référence : ce que l'utilisateur confirme pour ses colis (« statut juste / faux »).
 * Sert uniquement à mesurer la qualité (docs/plan/roadmap.md). Stockée en local, hors git.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { UserStatus } from "@coly/core";
import { dataPath } from "./paths.ts";

export const GROUND_TRUTH_FILE = dataPath("verite.json");

export interface GroundTruthEntry {
  /** Statut réel selon l'utilisateur au moment de la vérification. */
  status: UserStatus;
  /** Statut affiché par Coly au moment de la vérification. */
  shownStatus: UserStatus | null;
  checkedAt: string;
}

export type GroundTruth = Record<string, GroundTruthEntry>;

export async function readGroundTruth(): Promise<GroundTruth> {
  try {
    return JSON.parse(await readFile(GROUND_TRUTH_FILE, "utf8")) as GroundTruth;
  } catch {
    return {};
  }
}

export async function recordGroundTruth(id: string, entry: GroundTruthEntry): Promise<void> {
  const truth = await readGroundTruth();
  truth[id] = entry;
  await mkdir(dirname(GROUND_TRUTH_FILE), { recursive: true });
  await writeFile(GROUND_TRUTH_FILE, JSON.stringify(truth, null, 2), { mode: 0o600 });
}
