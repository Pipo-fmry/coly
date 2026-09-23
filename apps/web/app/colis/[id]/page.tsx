import { readState } from "@coly/worker/sync";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime, since } from "../../format";
import {
  availableSince,
  carrierName,
  displayMerchant,
  gmailLink,
  pickupQrEmail,
  STATUS_LABEL,
  timeline,
} from "../../view-model";
import { TruthCheck } from "./truth-check";

export const dynamic = "force-dynamic";

export default async function ShipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await readState();
  const shipment = state?.shipments.find((s) => s.id === decodeURIComponent(id));
  if (!shipment) notFound();

  const status = shipment.status ? STATUS_LABEL[shipment.status] : undefined;
  const carrier = carrierName(shipment);
  const events = timeline(shipment);
  const arrived = availableSince(shipment);
  const qrEmail = pickupQrEmail(shipment);
  const related = [...new Set(shipment.snapshots.flatMap((s) => s.relatedNumbers))];
  const placeQuery = [shipment.placeName, shipment.placeAddress].filter(Boolean).join(" ");
  const upcoming =
    shipment.status !== "available_for_pickup"
      ? shipment.carrierEmails.findLast((e) => e.kind === "in_transit" && e.pickupPoint)
      : undefined;

  return (
    <main className="screen">
      <Link href="/" className="back" aria-label="Retour">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="M5 12l6 6" />
          <path d="M5 12l6 -6" />
        </svg>
      </Link>

      <header className="detail-header">
        <span className={`pill pill-${status?.tone ?? "done"}`}>
          {status?.label ?? "Statut inconnu"}
        </span>
        <h1 className="title">{displayMerchant(shipment)}</h1>
        <p className="meta">
          {carrier} · <code>{shipment.id}</code>
        </p>
      </header>

      {shipment.status === "available_for_pickup" && (
        <section className="place">
          <div>
            <div className="place-name">{shipment.placeName ?? `Point relais ${carrier}`}</div>
            {shipment.placeAddress && <div className="place-meta">{shipment.placeAddress}</div>}
            {arrived && <div className="place-meta">Arrivé {since(arrived)}</div>}
          </div>
          <div className="place-actions">
            {qrEmail && (
              <a
                className="button-primary"
                href={gmailLink(qrEmail.messageId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                QR code de retrait
              </a>
            )}
            {placeQuery && (
              <a
                className="button-on-dark"
                href={`https://maps.apple.com/?q=${encodeURIComponent(placeQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Itinéraire
              </a>
            )}
          </div>
        </section>
      )}

      {upcoming?.pickupPoint && (
        <section className="empty">
          <h2>Arrive au relais {upcoming.pickupPoint.name}</h2>
          <p>
            {upcoming.pickupPoint.address}
            {upcoming.availableOn ? ` · prévu le ${upcoming.availableOn}` : ""}
          </p>
        </section>
      )}

      <TruthCheck id={shipment.id} shown={shipment.status ?? null} />

      {shipment.trackingUrl && (
        <a
          className="button-secondary"
          href={shipment.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Suivi {carrier}
        </a>
      )}

      <section className="section">
        <h2 className="section-title">Trajet</h2>
        {events.length === 0 ? (
          <p className="meta">Aucun événement.</p>
        ) : (
          <ol className="timeline">
            {events.map((e) => (
              <li key={`${e.at}-${e.label}`}>
                <span className="timeline-label">{e.label}</span>
                <span className="timeline-meta">
                  {[e.at && formatDateTime(e.at), e.location].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {related.length > 0 && (
        <section className="list detail-facts">
          <div className="fact">
            <span className="meta">Numéros liés</span>
            <span>{related.join(", ")}</span>
          </div>
        </section>
      )}
    </main>
  );
}
