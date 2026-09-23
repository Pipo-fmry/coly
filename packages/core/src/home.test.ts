import { describe, expect, it } from "vitest";
import { buildHome, daysLeft, type HomeShipment } from "./home.ts";

const now = new Date("2026-09-23T10:00:00Z");
const ship = (s: Partial<HomeShipment> & { id: string }): HomeShipment => ({
  merchant: "exemple.fr",
  carrier: "colissimo",
  status: "in_transit",
  ...s,
});

describe("buildHome", () => {
  it("regroupe les colis à retirer par lieu, le lieu le plus pressé d'abord", () => {
    const view = buildHome(
      [
        ship({
          id: "1",
          status: "available_for_pickup",
          placeName: "Shop N Food",
          pickupDeadline: "2026-09-29T18:00:00Z",
        }),
        ship({
          id: "2",
          status: "available_for_pickup",
          placeName: "Shop N Food",
          pickupDeadline: "2026-09-30T18:00:00Z",
        }),
        ship({
          id: "3",
          status: "available_for_pickup",
          placeName: "Tabac du Prado",
          pickupDeadline: "2026-09-27T18:00:00Z",
        }),
      ],
      now,
    );
    expect(view.places.map((p) => [p.name, p.shipments.length])).toEqual([
      ["Tabac du Prado", 1],
      ["Shop N Food", 2],
    ]);
    expect(view.places[1]?.earliestDeadline).toBe("2026-09-29T18:00:00Z");
  });

  it("met en urgent les problèmes et les retraits du dernier jour", () => {
    const view = buildHome(
      [
        ship({ id: "p", status: "problem" }),
        ship({
          id: "d",
          status: "available_for_pickup",
          placeName: "X",
          pickupDeadline: "2026-09-24T09:00:00Z",
        }),
        ship({ id: "t", status: "out_for_delivery" }),
        ship({ id: "l", status: "delivered" }),
      ],
      now,
    );
    expect(view.urgent.map((s) => s.id)).toEqual(["p", "d"]);
    expect(view.inTransit.map((s) => s.id)).toEqual(["t"]);
    expect(view.done.map((s) => s.id)).toEqual(["l"]);
    expect(view.places).toEqual([]);
  });
});

describe("daysLeft", () => {
  it("compte les jours pleins restants", () => {
    expect(daysLeft("2026-09-25T10:00:00Z", now)).toBe(2);
    expect(daysLeft("2026-09-23T20:00:00Z", now)).toBe(0);
  });
});
