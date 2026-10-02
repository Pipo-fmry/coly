/**
 * Session côté serveur : cookie signé, lu à chaque requête. Toute page ou route qui touche des données
 * passe par `requireSession()` et n'accède qu'au dossier de cet utilisateur (ADR 0016).
 * La protection CSRF des routes mutantes est dans `proxy.ts`.
 */

import { config, isDemoUser } from "@coly/worker/config";
import { signSession, verifySession } from "@coly/worker/session";
import { readProfile } from "@coly/worker/users";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export interface Session {
  /** Identifiant Google (`sub`), clé du dossier de données de l'utilisateur. */
  userId: string;
  email: string;
}

export const SESSION_COOKIE = "coly_session";
export const OAUTH_COOKIE = "coly_oauth";
const SESSION_TTL_MS = 30 * 86_400_000;

async function cookieUserId(): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(config.sessionSecret(), token, new Date()) : undefined;
}

/**
 * Session valide = jeton signé **et** compte toujours existant et invité : retirer une adresse de
 * `ALLOWED_EMAILS` ou effacer son compte coupe l'accès sans attendre l'expiration du cookie.
 * En mode démo, la session est ouverte d'office sur le compte fictif.
 */
export async function getSession(): Promise<Session | undefined> {
  const userId = config.demoUserId() ?? (await cookieUserId());
  if (!userId) return undefined;
  const profile = await readProfile(userId);
  if (!profile) return undefined;
  if (!isDemoUser(userId) && !config.allowedEmails().includes(profile.email)) return undefined;
  return { userId, email: profile.email };
}

export async function requireSession(): Promise<Session> {
  return (await getSession()) ?? redirect("/connexion");
}

export const callbackUrl = () => new URL("/api/auth/callback", config.appUrl()).toString();

/** Redirection vers un chemin de l'app, résolu sur `APP_URL` (l'URL publique, pas celle vue par le serveur). */
export const redirectTo = (path: string, status = 302) =>
  NextResponse.redirect(new URL(path, config.appUrl()), status);

/** Options communes : HttpOnly, SameSite=Lax, Secure dès que l'app est servie en HTTPS. */
const cookieOptions = (maxAge: number, path = "/") => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.appUrl().protocol === "https:",
  maxAge,
  path,
});

export function setOauthCookie(response: NextResponse, value: string): NextResponse {
  response.cookies.set(OAUTH_COOKIE, value, cookieOptions(600, "/api/auth"));
  return response;
}

export function clearOauthCookie(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_COOKIE, "", cookieOptions(0, "/api/auth"));
  return response;
}

export function setSessionCookie(response: NextResponse, userId: string): NextResponse {
  const token = signSession(config.sessionSecret(), userId, new Date(), SESSION_TTL_MS);
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS / 1000));
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return response;
}
