/** Dossier de données local du prototype (`data/` à la racine du repo, ignoré par git). */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

function repoRoot(from: string): string {
  let dir = from;
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) return from;
    dir = parent;
  }
  return dir;
}

const DATA_DIR = process.env["COLY_DATA_DIR"] ?? join(repoRoot(process.cwd()), "data");

export function dataPath(file: string): string {
  return join(DATA_DIR, file);
}
