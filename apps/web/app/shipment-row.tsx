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
        <span className="row-label">{shipment.merchant}</span>
        <span className="row-meta">
          {shipment.carrier}
          {shipment.placeName && shipment.status !== "available_for_pickup"
            ? ` · ${shipment.placeName}`
            : ""}
        </span>
      </span>
      <span className={`pill pill-${status?.tone ?? "done"}`}>{status?.label ?? "Inconnu"}</span>
    </Link>
  );
}
