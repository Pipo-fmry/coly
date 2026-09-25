import type { HomeShipment } from "@coly/core";
import { readState } from "@coly/worker/sync";
import Link from "next/link";
import { formatDate, since } from "./format";
import { RefreshButton } from "./refresh-button";
import { ShipmentRow, shipmentHref } from "./shipment-row";
import { toHomeView } from "./view-model";

export const dynamic = "force-dynamic";

function Section({
  title,
  items,
  urgent,
}: {
  title: string;
  items: HomeShipment[];
  urgent?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="section">
      <h2 className="section-title">
        {urgent && <span className="dot" aria-hidden="true" />}
        {title}
      </h2>
      <div className="list">
        {items.map((s) => (
          <ShipmentRow key={s.id} shipment={s} />
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const state = await readState();

  if (!state) {
    return (
      <main className="screen">
        <h1 className="title">Colis</h1>
        <section className="empty">
          <h2>Aucun colis</h2>
          <p>
            Lance <code>pnpm spike</code> sur le Mac.
          </p>
        </section>
      </main>
    );
  }

  const view = toHomeView(state, new Date());

  return (
    <main className="screen">
      <header className="header">
        <div>
          <h1 className="title">Colis</h1>
          <p className="meta">Mis à jour {since(state.updatedAt)}</p>
        </div>
        <RefreshButton />
      </header>

      <Section title="Urgent" items={view.urgent} urgent />

      {view.places.length > 0 && (
        <section className="section">
          <h2 className="section-title">À retirer</h2>
          {view.places.map((place) => {
            const only = place.shipments.length === 1 ? place.shipments[0] : undefined;
            return (
              <Link
                key={place.name}
                className="place"
                href={only ? shipmentHref(only) : `/lieu/${encodeURIComponent(place.name)}`}
              >
                <div className="place-name">
                  {place.shipments.map((s) => s.merchant).join(", ")}
                </div>
                <div>
                  <div className="place-where">
                    {place.name}
                    {place.shipments.length > 1 ? ` · ${place.shipments.length} colis` : ""}
                  </div>
                  <div className="place-meta">
                    {[
                      place.earliestDeadline
                        ? `Avant le ${formatDate(place.earliestDeadline)}`
                        : place.oldestArrival && `Arrivé ${since(place.oldestArrival)}`,
                      [...new Set(place.shipments.map((s) => s.carrier))].join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <Section title="En route" items={view.inTransit} />
      <Section title="Statut inconnu" items={view.unknown} />
      <Section title="Terminés" items={view.done} />
    </main>
  );
}
