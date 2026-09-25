import { readState } from "@coly/worker/sync";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime, since } from "../../format";
import {
  availableSince,
  carrierName,
  DONE,
  destination,
  displayMerchant,
  estimatedDelivery,
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
  // En route : dernière nouvelle puis destination, le trajet complet vient ensuite.
  const onTheWay =
    shipment.status !== "available_for_pickup" && !(shipment.status && DONE.has(shipment.status));
  const latest = events[0];
  const where = destination(shipment);
  const expected = estimatedDelivery(shipment);

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

      {onTheWay && (
        <>
          <section className="card">
            <span className="card-label">Dernière nouvelle</span>
            <h2>{latest?.label ?? "Aucune nouvelle du transporteur"}</h2>
            {latest && (
              <p>
                {[latest.at && formatDateTime(latest.at), latest.location]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </section>
          <section className="card">
            <span className="card-label">Arrive à</span>
            <h2>{where?.name ?? "Pas encore communiqué"}</h2>
            {(where?.address || where?.on || expected) && (
              <p>
                {[
                  where?.address,
                  where?.on
                    ? `prévu le ${where.on}`
                    : expected && `prévu le ${formatDate(expected)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </section>
        </>
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
