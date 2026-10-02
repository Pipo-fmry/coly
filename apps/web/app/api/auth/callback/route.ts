/**
 * Retour de Google : vérifie l'état, échange le code, n'accepte que les adresses invitées,
 * enregistre le refresh token chiffré dans le dossier de l'utilisateur et ouvre la session.
 */

import { config } from "@coly/worker/config";
import { exchangeCode, revokeToken } from "@coly/worker/oauth";
import { saveGrant } from "@coly/worker/users";
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
const failed = (reason: string) =>
  redirectWith(`/connexion?erreur=${reason}`, [clearOauthCookie(), clearSessionCookie()]);

function oauthCookie(request: Request): { state: string; verifier: string } | undefined {
  const match = /(?:^|;\s*)coly_oauth=([^;]+)/.exec(request.headers.get("cookie") ?? "");
  const [state, verifier] = (match?.[1] ?? "").split(".");
  return state && verifier ? { state, verifier } : undefined;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const expected = oauthCookie(request);
  if (params.get("error") === "access_denied") return failed("refus");
  if (!code || !expected || params.get("state") !== expected.state) return failed("etat");

  try {
    const grant = await exchangeCode(config.google(), {
      code,
      redirectUri: callbackUrl(),
      verifier: expected.verifier,
    });
    if (!config.allowedEmails().includes(grant.identity.email)) {
      // Adresse non invitée : on ne garde rien, et on rend le token à Google.
      await revokeToken(grant.refreshToken);
      return failed("non-invite");
    }
    const profile = await saveGrant(grant, config.encryptionKey(), new Date());
    return redirectWith("/", [
      sessionCookie({ userId: profile.id, email: profile.email }),
      clearOauthCookie(),
    ]);
  } catch (error) {
    // Jamais de token ni d'email ici : le message d'erreur OAuth n'en contient pas.
    process.stderr.write(`Connexion Google : ${String(error)}\n`);
    return failed("google");
  }
}
