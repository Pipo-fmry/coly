import { findShipment } from "@coly/worker/sync";
import { notFound } from "next/navigation";
import { BackLink } from "../../back-link";
import { formatDate, formatDateTime, since } from "../../format";
import { PlaceMap } from "../../place-map";
import {
  availableSince,
  carrierName,
  destination,
  estimatedDelivery,
  gmailLink,
  isOnTheWay,
  pickupQrEmail,
  STATUS_LABEL,
  timeline,
} from "../../view-model";
import { TruthCheck } from "./truth-check";

export const dynamic = "force-dynamic";

export default async function ShipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await findShipment(decodeURIComponent(id));
  if (!shipment) notFound();
  const { merchant } = shipment;

  const status = shipment.status ? STATUS_LABEL[shipment.status] : undefined;
  const carrier = carrierName(shipment);
  const events = timeline(shipment);
  const arrived = availableSince(shipment);
  const pickup = shipment.pickup;
  const proofEmail = pickup?.messageId ?? pickupQrEmail(shipment)?.messageId;
  const related = [...new Set(shipment.snapshots.flatMap((s) => s.relatedNumbers))];
  const placeQuery = [shipment.placeName, shipment.placeAddress].filter(Boolean).join(" ");
  // En route : dernière nouvelle puis destination, le trajet complet vient ensuite.
  const onTheWay = isOnTheWay(shipment);
  const latest = events[0];
  const where = destination(shipment);
  const expected = estimatedDelivery(shipment);

  return (
    <main className="screen">
      <BackLink />

      <header className="detail-header">
        <span className={`pill pill-${status?.tone ?? "done"}`}>
          {status?.label ?? "Statut inconnu"}
        </span>
        <h1 className="title">{merchant?.value ?? "Marchand inconnu"}</h1>
        <p className="meta">
          {carrier} · <code>{shipment.id}</code>
        </p>
      </header>

      {shipment.status === "available_for_pickup" && (
        <>
          {/* L'information n°1 au relais : le code ou le QR, tel que le transporteur l'a envoyé. */}
          <section className="card pickup-proof">
            <span className="card-label">À présenter au relais</span>
            {pickup?.image && (
              // biome-ignore lint/performance/noImgElement: image servie telle quelle, pas d'optimisation voulue
              <img
                className="pickup-image"
                src={`/api/retrait/${encodeURIComponent(shipment.id)}`}
                alt="QR code de retrait"
              />
            )}
            {pickup?.code && <p className="pickup-code">{pickup.code}</p>}
            {!pickup?.image && !pickup?.code && (
              <p>
                {proofEmail ? "Code non lu automatiquement." : "Aucun code trouvé dans tes emails."}
              </p>
            )}
            {!pickup?.image && proofEmail && (
              <a
                className="button-secondary"
                href={gmailLink(proofEmail)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir l'email du transporteur
              </a>
            )}
          </section>

          <section className="place">
            <div>
              <div className="place-name">{shipment.placeName ?? `Point relais ${carrier}`}</div>
              {shipment.placeAddress && <div className="place-meta">{shipment.placeAddress}</div>}
              {arrived && <div className="place-meta">Arrivé {since(arrived)}</div>}
            </div>
            {placeQuery && (
              <>
                <PlaceMap query={placeQuery} />
                <a
                  className="button-on-dark"
                  href={`https://maps.apple.com/?q=${encodeURIComponent(placeQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Itinéraire
                </a>
              </>
            )}
          </section>
        </>
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
            {where?.address && <PlaceMap query={`${where.name} ${where.address}`} />}
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

      {/* D'où vient chaque information : le marchand peut être déduit (ADR 0016). */}
      <section className="list detail-facts">
        <div className="fact">
          <span className="meta">Marchand</span>
          <span>
            {merchant
              ? `${merchant.value}${merchant.confidence === "probable" ? " (probable)" : ""} · ${merchant.sources.join(", ")}`
              : "inconnu"}
          </span>
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
