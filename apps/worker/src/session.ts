/**
 * Jeton de session signé (HMAC-SHA256), porté par un cookie HttpOnly. Aucun état serveur : la vérification
 * de la signature et de l'expiration suffit. Le secret est `SESSION_SECRET` (config).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface Session {
  /** Identifiant Google (`sub`), clé du dossier de données de l'utilisateur. */
  userId: string;
  email: string;
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const sign = (secret: Buffer, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function signSession(secret: Buffer, session: Session, now: Date, ttlMs: number): string {
  const payload = encode({ u: session.userId, e: session.email, x: now.getTime() + ttlMs });
  return `${payload}.${sign(secret, payload)}`;
}

/** Session portée par le jeton, ou undefined s'il est altéré, mal formé ou expiré. */
export function verifySession(secret: Buffer, token: string, now: Date): Session | undefined {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: unknown;
      e?: unknown;
      x?: unknown;
    };
    if (
      typeof claims.u !== "string" ||
      typeof claims.e !== "string" ||
      typeof claims.x !== "number"
    )
      return undefined;
    if (claims.x <= now.getTime()) return undefined;
    return { userId: claims.u, email: claims.e };
  } catch {
    return undefined;
  }
}
