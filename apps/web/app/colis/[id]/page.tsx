import { readState } from "@coly/worker/sync";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime, since } from "../../format";
import {
  availableSince,
  carrierName,
  displayMerchant,
  gmailLink,
  pickupQrEmail,
  SOURCES,
  STATUS_LABEL,
  timeline,
} from "../../view-model";

export const dynamic = "force-dynamic";

export default async function ShipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = await readState();
  const shipment = state?.shipments.find((s) => s.id === decodeURIComponent(id));
  if (!shipment) notFound();

  const status = shipment.status ? STATUS_LABEL[shipment.status] : undefined;
  const carrier = carrierName(shipment);
  const events = timeline(shipment);
  const sources = [
    ...new Set([
      ...shipment.snapshots.filter((s) => s.found).map((s) => SOURCES[s.source] ?? s.source),
      ...(shipment.carrierEmails.length > 0 ? [`email ${carrier}`] : []),
    ]),
  ];
  const arrived = availableSince(shipment);
  const qrEmail = pickupQrEmail(shipment);
  const related = [...new Set(shipment.snapshots.flatMap((s) => s.relatedNumbers))];
  const firstEmail = shipment.sightings.map((s) => s.date).sort()[0];
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

      {sources.length > 0 && shipment.lastUpdate && (
        <p className="confirmed">
          Selon {sources.join(" et ")}, dernière info {since(shipment.lastUpdate)}.
        </p>
      )}

      {shipment.status === "available_for_pickup" && (
        <section className="place">
          <div>
            <div className="place-name">{shipment.placeName ?? `Point relais ${carrier}`}</div>
            {shipment.placeAddress && <div className="place-meta">{shipment.placeAddress}</div>}
            <div className="place-meta">
              {arrived
                ? `Arrivé le ${formatDate(arrived)} (${since(arrived)})`
                : "Date d'arrivée inconnue"}
            </div>
          </div>
          {!shipment.placeName && (
            <div className="place-meta">
              Aucune source n'a encore donné le nom ni l'adresse du relais : ils sont sur la page{" "}
              {carrier}.
            </div>
          )}
          <div className="place-actions">
            {qrEmail && (
              <a
                className="button-primary"
                href={gmailLink(qrEmail.messageId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Afficher le QR code de retrait
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
          {qrEmail && (
            <div className="place-meta">
              QR code envoyé par {carrier} le {formatDate(qrEmail.receivedAt)}, ouvert tel quel dans
              Gmail. À défaut : pièce d'identité.
            </div>
          )}
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

      {shipment.trackingUrl && (
        <a
          className="button-secondary"
          href={shipment.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Voir le suivi sur le site {carrier}
        </a>
      )}

      <section className="section">
        <h2 className="section-title">Trajet</h2>
        {events.length === 0 ? (
          <p className="meta">Aucun événement transporteur pour l'instant.</p>
        ) : (
          <ol className="timeline">
            {events.map((e) => (
              <li key={`${e.at}-${e.label}`}>
                <span className="timeline-label">{e.label}</span>
                <span className="timeline-meta">
                  {[
                    e.at && formatDateTime(e.at),
                    e.location,
                    e.courier?.toUpperCase(),
                    SOURCES[e.source],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="list detail-facts">
        <div className="fact">
          <span className="meta">Premier email</span>
          <span>{firstEmail ? formatDate(firstEmail) : "—"}</span>
        </div>
        <div className="fact">
          <span className="meta">Expéditeur</span>
          <span>{shipment.merchant}</span>
        </div>
        {related.length > 0 && (
          <div className="fact">
            <span className="meta">Numéros liés</span>
            <span>{related.join(", ")}</span>
          </div>
        )}
      </section>
    </main>
  );
}
