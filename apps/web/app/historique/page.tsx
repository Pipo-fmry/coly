import { readState } from "@coly/worker/sync";
import { BackLink } from "../back-link";
import { ShipmentRow } from "../shipment-row";
import { toHomeView } from "../view-model";

export const dynamic = "force-dynamic";

/** Colis livrés, retirés ou retournés : consultables, mais hors de l'accueil. */
export default async function History() {
  const state = await readState();
  const done = state ? toHomeView(state, new Date()).done : [];

  return (
    <main className="screen">
      <BackLink />
      <h1 className="title">Historique</h1>
      {done.length === 0 ? (
        <p className="meta">Aucun colis terminé.</p>
      ) : (
        <div className="list">
          {done.map((s) => (
            <ShipmentRow key={s.id} shipment={s} />
          ))}
        </div>
      )}
    </main>
  );
}
