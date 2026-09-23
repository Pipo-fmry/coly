/** Relance la synchronisation (bouton « Actualiser »). Jamais de consentement Google ici : il se fait sur le Mac. */

import { MissingConfigError } from "@coly/worker/config";
import { ConsentRequiredError } from "@coly/worker/oauth";
import { runSync } from "@coly/worker/sync";

export const dynamic = "force-dynamic";

let running: Promise<unknown> | undefined;

export async function POST(request: Request): Promise<Response> {
  // Refuse les requêtes d'une autre origine (protection CSRF basique).
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return Response.json({ error: "Origine refusée." }, { status: 403 });
  }
  if (running) return Response.json({ error: "Actualisation déjà en cours." }, { status: 409 });

  try {
    running = runSync({ max: 300, aggregatorLimit: 15 });
    await running;
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof ConsentRequiredError || error instanceof MissingConfigError
        ? error.message
        : "Actualisation impossible, voir le terminal du Mac.";
    if (!(error instanceof ConsentRequiredError || error instanceof MissingConfigError))
      process.stderr.write(`Actualisation : ${String(error)}\n`);
    return Response.json({ error: message }, { status: 503 });
  } finally {
    running = undefined;
  }
}
