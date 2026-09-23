import { readState } from "@coly/worker/sync";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShipmentRow } from "../../shipment-row";
import { toHomeView } from "../../view-model";

export const dynamic = "force-dynamic";

/** Un lieu de retrait et tous les colis qui y attendent. */
export default async function PlaceDetail({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const state = await readState();
  const place = state
    ? toHomeView(state, new Date()).places.find((p) => p.name === decodeURIComponent(name))
    : undefined;
  if (!state || !place) notFound();

  const address = state.shipments.find(
    (s) => s.placeName === place.name && s.placeAddress,
  )?.placeAddress;
  const query = [place.name, address].filter(Boolean).join(" ");

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
