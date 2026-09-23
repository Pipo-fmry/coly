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

export const config = {
  google: () => ({
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
  }),
  laposteKey: () => optional("LAPOSTE_OKAPI_KEY"),
  aggregatorKey: () => optional("AGGREGATOR_API_KEY"),
  encryptionKey: () => {
    const key = Buffer.from(required("FIELD_ENCRYPTION_KEY"), "base64");
    if (key.length !== 32)
      throw new MissingConfigError("FIELD_ENCRYPTION_KEY doit faire 32 octets en base64.");
    return key;
  },
};
