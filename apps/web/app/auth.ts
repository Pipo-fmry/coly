/**
 * Session côté serveur : cookie signé, lu à chaque requête. Toute page ou route qui touche des données
 * passe par `requireSession()` et n'accède qu'au dossier de cet utilisateur (ADR 0016).
 */

import { config } from "@coly/worker/config";
import { type Session, signSession, verifySession } from "@coly/worker/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "coly_session";
export const OAUTH_COOKIE = "coly_oauth";
const SESSION_TTL_MS = 30 * 86_400_000;

export async function getSession(): Promise<Session | undefined> {
  const demo = config.demoUser();
  if (demo) return demo;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(config.sessionSecret(), token, new Date()) : undefined;
}

export async function requireSession(): Promise<Session> {
  return (await getSession()) ?? redirect("/connexion");
}

export const callbackUrl = () => new URL("/api/auth/callback", config.appUrl()).toString();

/** En-tête Set-Cookie : HttpOnly, SameSite=Lax, Secure dès que l'app est servie en HTTPS. */
export function cookieHeader(
  name: string,
  value: string,
  maxAgeSeconds: number,
  path = "/",
): string {
  const secure = config.appUrl().protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=${path}; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

export const sessionCookie = (session: Session) =>
  cookieHeader(
    SESSION_COOKIE,
    signSession(config.sessionSecret(), session, new Date(), SESSION_TTL_MS),
    SESSION_TTL_MS / 1000,
  );

export const clearSessionCookie = () => cookieHeader(SESSION_COOKIE, "", 0);

/** Redirection avec cookies (Response.redirect renvoie des en-têtes figés). */
export function redirectWith(location: string, setCookies: string[], status = 302): Response {
  const headers = new Headers({ location });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(null, { status, headers });
}

/** Refuse une requête mutante venue d'une autre origine (protection CSRF). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === request.headers.get("host");
}
