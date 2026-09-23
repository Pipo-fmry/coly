/**
 * OAuth Google pour application de bureau : redirection loopback + PKCE, scope gmail.readonly uniquement.
 * Le refresh token est chiffré sur disque (data/, ignoré par git).
 */

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { readSecret, writeSecret } from "../secret-store.ts";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_FILE = "data/gmail-refresh-token.enc";

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface Credentials {
  clientId: string;
  clientSecret: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, { method: "POST", body: new URLSearchParams(params) });
  const body = (await response.json()) as TokenResponse;
  if (!response.ok)
    throw new Error(
      `OAuth Google : ${body.error ?? response.status} ${body.error_description ?? ""}`,
    );
  return body;
}

/** Ouvre le consentement Google, attend le retour sur 127.0.0.1, renvoie le refresh token. */
async function authorize(creds: Credentials, onUrl: (url: string) => void): Promise<string> {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");

  const { code, redirectUri } = await new Promise<{ code: string; redirectUri: string }>(
    (resolve, reject) => {
      const server = createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        const code = url.searchParams.get("code");
        const ok = code !== null && url.searchParams.get("state") === state;
        res.writeHead(ok ? 200 : 400, { "content-type": "text/plain; charset=utf-8" });
        res.end(
          ok ? "Coly est connecté à Gmail. Tu peux fermer cet onglet." : "Échec de l'autorisation.",
        );
        server.close();
        if (ok) resolve({ code, redirectUri });
        else
          reject(
            new Error(`Autorisation refusée : ${url.searchParams.get("error") ?? "état invalide"}`),
          );
      });
      let redirectUri = "";
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address === null || typeof address === "string")
          return reject(new Error("Port local indisponible"));
        redirectUri = `http://127.0.0.1:${address.port}`;
        const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        auth.search = new URLSearchParams({
          client_id: creds.clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: SCOPE,
          access_type: "offline",
          prompt: "consent",
          state,
          code_challenge: challenge,
          code_challenge_method: "S256",
        }).toString();
        onUrl(auth.toString());
      });
    },
  );

  const tokens = await tokenRequest({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  if (!tokens.refresh_token) throw new Error("Google n'a pas renvoyé de refresh token.");
  return tokens.refresh_token;
}

/** Access token valide, en lançant le consentement si aucun refresh token n'est stocké (ou s'il a expiré). */
export async function getAccessToken(
  creds: Credentials,
  encryptionKey: Buffer,
  onUrl: (url: string) => void,
): Promise<string> {
  let refreshToken = await readSecret(TOKEN_FILE, encryptionKey);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!refreshToken) {
      refreshToken = await authorize(creds, onUrl);
      await writeSecret(TOKEN_FILE, encryptionKey, refreshToken);
    }
    try {
      const tokens = await tokenRequest({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      });
      if (tokens.access_token) return tokens.access_token;
    } catch {
      // Refresh token expiré (7 jours en mode « test » Google) : on redemande le consentement.
    }
    refreshToken = undefined;
  }
  throw new Error("Impossible d'obtenir un access token Gmail.");
}
