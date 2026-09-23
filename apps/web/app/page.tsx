import type { HomeShipment } from "@coly/core";
import { readState } from "@coly/worker/sync";
import Link from "next/link";
import { formatDate, since } from "./format";
import { RefreshButton } from "./refresh-button";
import { STATUS_LABEL, toHomeView } from "./view-model";

export const dynamic = "force-dynamic";

const href = (s: HomeShipment) => `/colis/${encodeURIComponent(s.id)}`;

function ShipmentRow({ shipment, detail }: { shipment: HomeShipment; detail?: string }) {
  const status = shipment.status ? STATUS_LABEL[shipment.status] : undefined;
  return (
    <Link className="row" href={href(shipment)}>
      <span className="avatar" aria-hidden="true">
        {shipment.merchant.charAt(0)}
      </span>
      <span className="row-text">
        <span className="row-label">{shipment.merchant}</span>
        <span className="row-meta">{detail ?? shipment.carrier}</span>
      </span>
      <span className={`pill pill-${status?.tone ?? "done"}`}>{status?.label ?? "Inconnu"}</span>
    </Link>
  );
}

export default async function Home() {
  const state = await readState();

  if (!state) {
    return (
      <main className="screen">
        <h1 className="title">Colis</h1>
        <section className="empty">
          <h2>Première synchronisation</h2>
          <p>
            Lance <code>pnpm spike</code> sur le Mac pour autoriser Gmail en lecture seule. Ensuite,
            le bouton Actualiser suffit.
          </p>
        </section>
      </main>
    );
  }

  const view = toHomeView(state, new Date());
  const { counts } = state;
  const nothingActive =
    view.urgent.length + view.places.length + view.inTransit.length + view.unknown.length === 0;

  return (
    <main className="screen">
      <header className="header">
        <div>
          <h1 className="title">Colis</h1>
          <p className="meta">Mis à jour {since(state.updatedAt)}</p>
        </div>
        <RefreshButton />
      </header>

      {nothingActive && (
        <section className="empty">
          <h2>Rien en cours</h2>
          <p>
            Aucun colis en route ni à retirer. Coly regarde tes nouveaux emails à chaque
            actualisation.
          </p>
        </section>
      )}

      {view.urgent.length > 0 && (
        <section className="section">
          <h2 className="section-title">
            <span className="dot" aria-hidden="true" />
            Urgent
          </h2>
          <div className="list">
            {view.urgent.map((s) => (
              <ShipmentRow
                key={s.id}
                shipment={s}
                detail={`${s.carrier}${s.placeName ? ` · ${s.placeName}` : ""}`}
              />
            ))}
          </div>
        </section>
      )}

      {view.places.length > 0 && (
        <section className="section">
          <h2 className="section-title">À retirer</h2>
          {view.places.map((place) => (
            <article key={place.name} className="place">
              <div>
                <div className="place-name">
                  {place.name} · {place.shipments.length} colis
                </div>
                <div className="place-meta">
                  {place.earliestDeadline
                    ? `Premier délai le ${formatDate(place.earliestDeadline)}`
                    : place.oldestArrival
                      ? `Arrivé ${since(place.oldestArrival)} · date limite non communiquée`
                      : "Date limite non communiquée"}
                </div>
              </div>
              <div className="place-items">
                {place.shipments.map((s) => (
                  <Link key={s.id} className="place-item" href={href(s)}>
                    {s.merchant}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {view.inTransit.length > 0 && (
        <section className="section">
          <h2 className="section-title">En route</h2>
          <div className="list">
            {view.inTransit.map((s) => (
              <ShipmentRow key={s.id} shipment={s} />
            ))}
          </div>
        </section>
      )}

      {view.unknown.length > 0 && (
        <section className="section">
          <h2 className="section-title">Statut inconnu</h2>
          <div className="list">
            {view.unknown.map((s) => (
              <ShipmentRow key={s.id} shipment={s} detail={`${s.carrier} · pas encore suivi`} />
            ))}
          </div>
        </section>
      )}

      {view.done.length > 0 && (
        <section className="section">
          <h2 className="section-title">Terminés</h2>
          <div className="list">
            {view.done.map((s) => (
              <ShipmentRow key={s.id} shipment={s} />
            ))}
          </div>
        </section>
      )}

      <section className="journal" aria-label="Ce que Coly a lu">
        <h2>Ce que Coly a lu</h2>
        <p>
          {counts.bodiesRead} emails de commande ou de livraison lus. Écartés sans être ouverts :{" "}
          {counts.skipped.marketing} marketing, {counts.skipped.feedback} demandes d'avis,{" "}
          {counts.skipped.not_transactional} autres. Aucun sujet ni contenu n'est conservé.
        </p>
        {view.archived > 0 && (
          <p>
            {view.archived} colis de plus de 30 jours sont présumés terminés : Coly ne les suit pas.
          </p>
        )}
      </section>
    </main>
  );
}
