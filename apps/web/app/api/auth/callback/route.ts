/**
 * Retour de Google : vérifie l'état, échange le code, n'accepte que les adresses invitées,
 * enregistre le refresh token chiffré dans le dossier de l'utilisateur et ouvre la session.
 */

import { config } from "@coly/worker/config";
import { exchangeCode, type GoogleGrant, revokeToken } from "@coly/worker/oauth";
import { saveGrant } from "@coly/worker/users";
import { cookies } from "next/headers";
import {
  callbackUrl,
  clearSessionCookie,
  cookieHeader,
  OAUTH_COOKIE,
  redirectWith,
  sessionCookie,
} from "../../../auth";

export const dynamic = "force-dynamic";

// Évalués à la requête, pas au chargement du module : la config n'est pas lue pendant `next build`.
const clearOauthCookie = () => cookieHeader(OAUTH_COOKIE, "", 0, "/api/auth");
/** Échec : on oublie le flux en cours ; la session existante (ré-autorisation Gmail) reste ouverte. */
const failed = (reason: string, cookies = [clearOauthCookie()]) =>
  redirectWith(`/connexion?erreur=${reason}`, cookies);

async function oauthCookie(): Promise<{ state: string; verifier: string } | undefined> {
  const [state, verifier] = ((await cookies()).get(OAUTH_COOKIE)?.value ?? "").split(".");
  return state && verifier ? { state, verifier } : undefined;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const expected = await oauthCookie();
  if (params.get("error") === "access_denied") return failed("refus");
  if (!code || !expected || params.get("state") !== expected.state) return failed("etat");

  let grant: GoogleGrant | undefined;
  try {
    grant = await exchangeCode(config.google(), {
      code,
      redirectUri: callbackUrl(),
      verifier: expected.verifier,
    });
    if (!config.allowedEmails().includes(grant.identity.email)) {
      // Adresse non invitée : rien n'est gardé, le token est rendu à Google, toute session est fermée.
      await revokeToken(grant.refreshToken);
      return failed("non-invite", [clearOauthCookie(), clearSessionCookie()]);
    }
    const profile = await saveGrant(grant, config.encryptionKey(), new Date());
    return redirectWith("/", [
      sessionCookie({ userId: profile.id, email: profile.email }),
      clearOauthCookie(),
    ]);
  } catch (error) {
    // Un token obtenu mais non enregistré ne doit pas rester actif chez Google.
    if (grant) await revokeToken(grant.refreshToken);
    // Jamais de token ni d'email ici : le message d'erreur OAuth n'en contient pas.
    process.stderr.write(`Connexion Google : ${String(error)}\n`);
    return failed("google");
  }
}
