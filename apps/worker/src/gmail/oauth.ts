/**
 * OAuth Google : un seul consentement donne l'identité (OpenID) et la lecture seule de Gmail (ADR 0016).
 * Deux entrées : redirection web (webapp, PKCE + state) et redirection loopback (CLI `pnpm spike`).
 * Aucun token n'est stocké ici : voir `users.ts`.
 */

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"].join(" ");
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
/** URI de redirection de la CLI, à déclarer telle quelle dans le client OAuth (docs/guides/testeurs.md). */
export const CLI_REDIRECT_URI = "http://127.0.0.1:8765";

/** Levée quand l'autorisation Gmail est absente ou expirée : l'utilisateur doit se reconnecter avec Google. */
export class ConsentRequiredError extends Error {}

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

export interface GoogleIdentity {
  /** Identifiant Google stable (`sub`) : c'est l'identifiant utilisateur de Coly. */
  id: string;
  email: string;
}

export interface GoogleGrant {
  identity: GoogleIdentity;
  refreshToken: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

class OAuthError extends Error {
  readonly code: string;
  constructor(code: string, description: string) {
    super(`OAuth Google : ${code} ${description}`.trim());
    this.code = code;
  }
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, { method: "POST", body: new URLSearchParams(params) });
  const body = (await response.json()) as TokenResponse;
  if (!response.ok)
    throw new OAuthError(body.error ?? String(response.status), body.error_description ?? "");
  return body;
}

/**
 * Identité portée par l'id_token. Reçu directement du point de terminaison token (TLS), il n'a pas besoin
 * d'une vérification de signature (OpenID Connect Core §3.1.3.7.6) ; on contrôle émetteur et audience.
 */
export function identityFromIdToken(idToken: string, clientId: string): GoogleIdentity {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("id_token Google illisible.");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    iss?: string;
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  if (!claims.iss || !ISSUERS.has(claims.iss) || claims.aud !== clientId)
    throw new Error("id_token Google inattendu (émetteur ou audience).");
  if (!claims.sub || !claims.email || claims.email_verified !== true)
    throw new Error("Google n'a pas fourni d'adresse email vérifiée.");
  return { id: claims.sub, email: claims.email.toLowerCase() };
}

/** Secrets d'un flux d'autorisation : vérificateur PKCE, son empreinte, et l'état anti-CSRF. */
export function newPkce(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(32).toString("base64url");
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
    state: randomBytes(16).toString("base64url"),
  };
}

export function authorizationUrl(
  creds: Credentials,
  params: { redirectUri: string; state: string; challenge: string },
): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    // `consent` force Google à renvoyer un refresh token à chaque connexion (sinon seulement la première fois).
    prompt: "consent",
    state: params.state,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/** Échange le code d'autorisation : identité + refresh token. */
export async function exchangeCode(
  creds: Credentials,
  params: { code: string; redirectUri: string; verifier: string },
): Promise<GoogleGrant> {
  const tokens = await tokenRequest({
    code: params.code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    code_verifier: params.verifier,
  });
  if (!tokens.refresh_token) throw new Error("Google n'a pas renvoyé de refresh token.");
  if (!tokens.id_token) throw new Error("Google n'a pas renvoyé d'id_token.");
  return {
    identity: identityFromIdToken(tokens.id_token, creds.clientId),
    refreshToken: tokens.refresh_token,
  };
}

/** Access token Gmail. Refresh token expiré ou révoqué (7 jours en mode « test » Google) : ConsentRequiredError. */
export async function refreshAccessToken(
  creds: Credentials,
  refreshToken: string,
): Promise<string> {
  try {
    const tokens = await tokenRequest({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    if (tokens.access_token) return tokens.access_token;
  } catch (error) {
    if (!(error instanceof OAuthError && error.code === "invalid_grant")) throw error;
  }
  throw new ConsentRequiredError("Autorisation Gmail expirée : reconnecte-toi avec Google.");
}

/** Révocation côté Google (déconnexion de Gmail). Échec silencieux : le token est de toute façon supprimé chez nous. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, { method: "POST", body: new URLSearchParams({ token }) }).catch(
    () => undefined,
  );
}

/** CLI : ouvre le consentement Google, attend le retour sur CLI_REDIRECT_URI. */
export async function authorizeOnDesktop(
  creds: Credentials,
  onUrl: (url: string) => void,
): Promise<GoogleGrant> {
  const { verifier, challenge, state } = newPkce();
  const { hostname, port } = new URL(CLI_REDIRECT_URI);

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", CLI_REDIRECT_URI);
      const code = url.searchParams.get("code");
      const ok = code !== null && url.searchParams.get("state") === state;
      res.writeHead(ok ? 200 : 400, { "content-type": "text/plain; charset=utf-8" });
      res.end(
        ok ? "Coly est connecté à Gmail. Tu peux fermer cet onglet." : "Échec de l'autorisation.",
      );
      server.close();
      if (ok) resolve(code);
      else
        reject(
          new Error(`Autorisation refusée : ${url.searchParams.get("error") ?? "état invalide"}`),
        );
    });
    server.once("error", reject);
    server.listen(Number(port), hostname, () =>
      onUrl(authorizationUrl(creds, { redirectUri: CLI_REDIRECT_URI, state, challenge })),
    );
  });

  return exchangeCode(creds, { code, redirectUri: CLI_REDIRECT_URI, verifier });
}
