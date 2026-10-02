/** Départ de « Se connecter avec Google » : PKCE et état gardés dans un cookie court, puis redirection. */

import { config } from "@coly/worker/config";
import { authorizationUrl, newPkce } from "@coly/worker/oauth";
import { callbackUrl, cookieHeader, OAUTH_COOKIE, redirectWith } from "../../../auth";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { verifier, challenge, state } = newPkce();
  const url = authorizationUrl(config.google(), { redirectUri: callbackUrl(), state, challenge });
  return redirectWith(url, [cookieHeader(OAUTH_COOKIE, `${state}.${verifier}`, 600, "/api/auth")]);
}
