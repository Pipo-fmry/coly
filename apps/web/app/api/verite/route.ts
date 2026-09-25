/** Enregistre la vérité de référence donnée par l'utilisateur pour un colis (mesure de fiabilité). */

import type { UserStatus } from "@coly/core";
import { recordGroundTruth } from "@coly/worker/ground-truth";
import { findShipment } from "@coly/worker/sync";

const STATUSES = new Set<UserStatus>([
  "ordered",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "available_for_pickup",
  "delivered",
  "picked_up",
  "returned",
  "problem",
]);

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host"))
    return Response.json({ error: "Origine refusée." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { id?: unknown; status?: unknown };
  const status = body.status as UserStatus;
  if (typeof body.id !== "string" || !STATUSES.has(status))
    return Response.json({ error: "Requête invalide." }, { status: 400 });

  // On n'accepte qu'un colis connu, et le statut affiché est relu côté serveur (pas celui du client).
  const shipment = await findShipment(body.id);
  if (!shipment) return Response.json({ error: "Colis inconnu." }, { status: 404 });

  await recordGroundTruth(shipment.id, {
    status,
    shownStatus: shipment.status ?? null,
    checkedAt: new Date().toISOString(),
  });
  return Response.json({ ok: true });
}
