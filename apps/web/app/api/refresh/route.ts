/** Relance la synchronisation de l'utilisateur connecté (bouton « Actualiser »). Un verrou par utilisateur. */

import { MissingConfigError } from "@coly/worker/config";
import { ConsentRequiredError } from "@coly/worker/oauth";
import { runSync } from "@coly/worker/sync";
import { getSession, sameOrigin } from "../../auth";

export const dynamic = "force-dynamic";

const running = new Map<string, Promise<unknown>>();

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Origine refusée." }, { status: 403 });
  const session = await getSession();
  if (!session) return Response.json({ error: "Connecte-toi d'abord." }, { status: 401 });
  const { userId } = session;
  if (running.has(userId))
    return Response.json({ error: "Actualisation déjà en cours." }, { status: 409 });

  try {
    const job = runSync({ userId, max: 300, aggregatorLimit: 15 });
    running.set(userId, job);
    await job;
    return Response.json({ ok: true });
  } catch (error) {
    // Autorisation Gmail absente ou expirée (7 jours en mode test Google) : retour à la connexion.
    if (error instanceof ConsentRequiredError)
      return Response.json({ error: error.message, reconnect: true }, { status: 401 });
    if (error instanceof MissingConfigError)
      return Response.json({ error: error.message }, { status: 503 });
    process.stderr.write(`Actualisation : ${String(error)}\n`);
    return Response.json(
      { error: "Actualisation impossible, voir le journal du serveur." },
      { status: 503 },
    );
  } finally {
    running.delete(userId);
  }
}
