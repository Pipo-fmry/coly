import { readState } from "@coly/worker/sync";
import { notFound } from "next/navigation";
import { BackLink } from "../../back-link";
import { ShipmentRow } from "../../shipment-row";
import { placeLine, placeQuery, toHomeView } from "../../view-model";

export const dynamic = "force-dynamic";

/** Un lieu de retrait et tous les colis qui y attendent. */
export default async function PlaceDetail({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const state = await readState();
  const place = state
    ? toHomeView(state, new Date()).places.find((p) => p.name === decodeURIComponent(name))
    : undefined;
  if (!state || !place) notFound();

  const here = state.shipments.find((s) => s.placeName === place.name && placeLine(s));
  const address = here && placeLine(here);
  const query = here ? placeQuery(here) : place.name;

  return (
    <main className="screen">
      <BackLink />
      <header className="detail-header">
        <h1 className="title">{place.name}</h1>
        {address && <p className="meta">{address}</p>}
      </header>
      <a
        className="button-secondary"
        href={`https://maps.apple.com/?q=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Itinéraire
      </a>
      <section className="section">
        <h2 className="section-title">{place.shipments.length} colis</h2>
        <div className="list">
          {place.shipments.map((s) => (
            <ShipmentRow key={s.id} shipment={s} />
          ))}
        </div>
      </section>
    </main>
  );
}
