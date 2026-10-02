/** Seul point de lecture de l'environnement (AGENTS.md, règle 4). Valeurs dans .env.local, jamais commitées. */

const ENV_FILE = ".env.local (à la racine du repo, modèle : .env.example)";

export class MissingConfigError extends Error {}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MissingConfigError(`Variable ${name} manquante dans ${ENV_FILE}.`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function key32(name: string): Buffer {
  const key = Buffer.from(required(name), "base64");
  if (key.length !== 32) throw new MissingConfigError(`${name} doit faire 32 octets en base64.`);
  return key;
}

export const config = {
  google: () => ({
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
  }),
  laposteKey: () => optional("LAPOSTE_OKAPI_KEY"),
  aggregatorKey: () => optional("AGGREGATOR_API_KEY"),
  encryptionKey: () => key32("FIELD_ENCRYPTION_KEY"),
  /** URL publique de la webapp : sert à construire l'URI de redirection OAuth et le drapeau Secure du cookie. */
  appUrl: () => new URL(required("APP_URL")),
  sessionSecret: () => key32("SESSION_SECRET"),
  /** Adresses autorisées à créer un compte (phase de test : liste fermée, ADR 0016). */
  allowedEmails: () =>
    required("ALLOWED_EMAILS")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  /** Mode démo (`pnpm web:demo`) : session fictive, jamais honorée en production. */
  demoUser: () => {
    const email = optional("COLY_DEMO_USER");
    if (!email || process.env["NODE_ENV"] === "production") return undefined;
    return { userId: "demo", email };
  },
};
