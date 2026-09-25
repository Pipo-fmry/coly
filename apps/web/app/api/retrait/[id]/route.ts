/** Image de retrait (QR / code-barres) d'un colis, servie telle que le transporteur l'a envoyée. */

import { readPickupImage, readState } from "@coly/worker/sync";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = (await readState())?.shipments.find((s) => s.id === decodeURIComponent(id));
  const image = shipment && (await readPickupImage(shipment));
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: { "content-type": image.mimeType, "cache-control": "private, no-store" },
  });
}
