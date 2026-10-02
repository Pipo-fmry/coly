/**
 * Comptes et données par utilisateur (ADR 0016) : `data/users/<id>/`, où <id> est l'identifiant Google (`sub`).
 * Tout accès aux données passe par un identifiant utilisateur : il n'existe plus de fichier global.
 */

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GoogleGrant } from "./gmail/oauth.ts";
import { dataPath } from "./paths.ts";
import { readSecret, writeSecret } from "./secret-store.ts";

/** Ce qu'on garde d'un compte : l'adresse sert à l'affichage et à retrouver l'utilisateur depuis la CLI. */
export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
}

const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Refuse tout identifiant qui pourrait sortir de `data/users/` (traversée de chemin). */
export function assertUserId(id: string): string {
  if (!USER_ID.test(id)) throw new Error("Identifiant utilisateur invalide.");
  return id;
}

export const userDir = (id: string) => dataPath(join("users", assertUserId(id)));
export const userStateFile = (id: string) => join(userDir(id), "state.json");
const profileFile = (id: string) => join(userDir(id), "profile.json");
const tokenFile = (id: string) => join(userDir(id), "gmail-refresh-token.enc");

export async function readProfile(id: string): Promise<UserProfile | undefined> {
  try {
    return JSON.parse(await readFile(profileFile(id), "utf8")) as UserProfile;
  } catch {
    return undefined;
  }
}

/** Crée le compte au premier consentement, puis remplace le refresh token (chiffré) à chaque connexion. */
export async function saveGrant(
  grant: GoogleGrant,
  encryptionKey: Buffer,
  now: Date,
): Promise<UserProfile> {
  const { id, email } = grant.identity;
  const profile: UserProfile = {
    id,
    email,
    createdAt: (await readProfile(id))?.createdAt ?? now.toISOString(),
  };
  // writeSecret crée le dossier ; le profil s'écrit ensuite.
  await writeSecret(tokenFile(id), encryptionKey, grant.refreshToken);
  await writeFile(profileFile(id), JSON.stringify(profile, null, 2), { mode: 0o600 });
  return profile;
}

export function readRefreshToken(id: string, encryptionKey: Buffer): Promise<string | undefined> {
  return readSecret(tokenFile(id), encryptionKey);
}

/** Suppression totale du compte : token, état, profil. */
export async function deleteUserData(id: string): Promise<void> {
  await rm(userDir(id), { recursive: true, force: true });
}

export async function listUsers(): Promise<UserProfile[]> {
  let ids: string[];
  try {
    ids = await readdir(dataPath("users"));
  } catch {
    return [];
  }
  const profiles = await Promise.all(ids.filter((id) => USER_ID.test(id)).map(readProfile));
  return profiles.filter((p): p is UserProfile => p !== undefined);
}

export async function findUserByEmail(email: string): Promise<UserProfile | undefined> {
  const wanted = email.trim().toLowerCase();
  return (await listUsers()).find((p) => p.email === wanted);
}
