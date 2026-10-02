/** Relance la synchronisation de l'utilisateur connecté (bouton « Actualiser »). */

import { isDemoUser, MissingConfigError } from "@coly/worker/config";
import { ConsentRequiredError } from "@coly/worker/oauth";
import { runSync, SyncInProgressError } from "@coly/worker/sync";
import { getSession } from "../../auth";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connecte-toi d'abord." }, { status: 401 });
  if (isDemoUser(session.userId))
    return Response.json(
      { error: "Mode démo : colis fictifs, pas de synchronisation." },
      { status: 503 },
    );

  try {
    await runSync({ userId: session.userId, max: 300, aggregatorLimit: 15 });
    return Response.json({ ok: true });
  } catch (error) {
    // Autorisation Gmail absente ou expirée (7 jours en mode test Google) : retour à la connexion.
    if (error instanceof ConsentRequiredError)
      return Response.json({ error: error.message, reconnect: true }, { status: 401 });
    if (error instanceof SyncInProgressError)
      return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof MissingConfigError)
      return Response.json({ error: error.message }, { status: 503 });
    process.stderr.write(`Actualisation : ${String(error)}\n`);
    return Response.json(
      { error: "Actualisation impossible, voir le journal du serveur." },
      { status: 503 },
    );
  }
}
