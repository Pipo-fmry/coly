import type { HomeShipment } from "@coly/core";
import Link from "next/link";
import { STATUS_LABEL } from "./view-model";

export const shipmentHref = (s: { id: string }) => `/colis/${encodeURIComponent(s.id)}`;

export function ShipmentRow({ shipment }: { shipment: HomeShipment }) {
  const status = shipment.status ? STATUS_LABEL[shipment.status] : undefined;
  return (
    <Link className="row" href={shipmentHref(shipment)}>
      <span className="avatar" aria-hidden="true">
        {shipment.merchant.charAt(0)}
      </span>
      <span className="row-text">
        <span className="row-label">
          {shipment.merchant}
          {shipment.merchantProbable && <span className="probable">probable</span>}
        </span>
        {/* Ce qu'on reçoit, puis où ; le transporteur en dernier, c'est l'info qui compte le moins. */}
        <span className="row-meta">
          {shipment.placeName && shipment.status !== "available_for_pickup"
            ? `Vers ${shipment.placeName} · `
            : ""}
          {shipment.carrier}
        </span>
      </span>
      <span className={`pill pill-${status?.tone ?? "done"}`}>{status?.label ?? "Inconnu"}</span>
    </Link>
  );
}
