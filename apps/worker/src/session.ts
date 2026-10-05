/**
 * Jeton de session signé (HMAC-SHA256), porté par un cookie HttpOnly. Il ne porte que l'identifiant
 * utilisateur et son expiration : tout le reste (email, existence du compte) se relit dans le profil.
 * Aucun état serveur. Le secret est `SESSION_SECRET` (config).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const sign = (secret: Buffer, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function signSession(secret: Buffer, userId: string, now: Date, ttlMs: number): string {
  const payload = encode({ u: userId, x: now.getTime() + ttlMs });
  return `${payload}.${sign(secret, payload)}`;
}

/** Identifiant utilisateur porté par le jeton, ou undefined s'il est altéré, mal formé ou expiré. */
export function verifySession(secret: Buffer, token: string, now: Date): string | undefined {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: unknown;
      x?: unknown;
    };
    if (typeof claims.u !== "string" || typeof claims.x !== "number") return undefined;
    return claims.x > now.getTime() ? claims.u : undefined;
  } catch {
    return undefined;
  }
}
