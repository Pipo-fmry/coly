/** Stockage local chiffré (AES-256-GCM) des secrets du prototype, ex. le refresh token Gmail. */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeSecret(path: string, key: Buffer, value: string): Promise<void> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const sealed = Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, sealed, { mode: 0o600 });
}

export async function readSecret(path: string, key: Buffer): Promise<string | undefined> {
  let sealed: Buffer;
  try {
    sealed = Buffer.from(await readFile(path, "utf8"), "base64");
  } catch {
    return undefined;
  }
  const decipher = createDecipheriv("aes-256-gcm", key, sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]).toString("utf8");
}
