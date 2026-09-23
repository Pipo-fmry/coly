import { randomBytes } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSecret, writeSecret } from "./secret-store.ts";

describe("secret-store", () => {
  it("chiffre sur disque et relit la valeur avec la bonne clé", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "coly-")), "token.enc");
    const key = randomBytes(32);
    await writeSecret(path, key, "refresh-token-de-test");
    expect(await readFile(path, "utf8")).not.toContain("refresh-token-de-test");
    expect(await readSecret(path, key)).toBe("refresh-token-de-test");
  });

  it("refuse une autre clé et renvoie undefined si le fichier n'existe pas", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "coly-")), "token.enc");
    await writeSecret(path, randomBytes(32), "x");
    await expect(readSecret(path, randomBytes(32))).rejects.toThrow();
    expect(await readSecret(`${path}.absent`, randomBytes(32))).toBeUndefined();
  });
});
