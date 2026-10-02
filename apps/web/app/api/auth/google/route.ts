/** Départ de « Se connecter avec Google » : PKCE et état gardés dans un cookie court, puis redirection. */

import { config } from "@coly/worker/config";
import { authorizationUrl, newAuthSecrets } from "@coly/worker/oauth";
import { NextResponse } from "next/server";
import { callbackUrl, setOauthCookie } from "../../../auth";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { verifier, challenge, state } = newAuthSecrets();
  const url = authorizationUrl(config.google(), { redirectUri: callbackUrl(), state, challenge });
  return setOauthCookie(NextResponse.redirect(url), `${state}.${verifier}`);
}
