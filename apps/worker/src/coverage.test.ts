import { describe, expect, it } from "vitest";
import { computeCoverage } from "./coverage.ts";
import type { ColyState, ShipmentState } from "./sync.ts";

const now = new Date("2026-09-23T12:00:00Z");

const shipment = (s: Partial<ShipmentState> & { id: string; carrier: string }): ShipmentState => ({
  candidate: { carrier: s.carrier as never, trackingNumber: s.id, via: "pattern" },
  merchant: "exemple.fr",
  sightings: [],
  carrierEmails: [],
  snapshots: [],
  status: undefined,
  ...s,
});

const state = (shipments: ShipmentState[]): ColyState => ({
  version: 3,
  updatedAt: now.toISOString(),
  syncedUntil: now.toISOString(),
  counts: {
    matchedQuery: 0,
    bodiesRead: 0,
    skipped: { marketing: 0, feedback: 0, not_transactional: 0 },
    aggregatorCalls: 0,
    carrierEmailsNotUnderstood: { "chronopost.fr": 2 },
  },
  shipments,
  readWithoutNumber: [],
});

describe("computeCoverage", () => {
  const report = computeCoverage(
    state([
      shipment({
        id: "A",
        carrier: "gls",
        status: "available_for_pickup",
        placeName: "RELAIS",
        merchantLabel: "Caats",
        placeAddress: "1 RUE X 13006 Marseille",
        lastUpdate: "2026-09-23T10:00:00Z",
        carrierEmails: [
          {
            messageId: "m",
            receivedAt: "2026-09-23T10:00:00Z",
            kind: "available_for_pickup",
            hasPickupQrCode: true,
          },
        ],
        pickup: {
          messageId: "m",
          receivedAt: "2026-09-23T10:00:00Z",
          image: { file: "A-m", mimeType: "image/png" },
        },
      }),
      shipment({
        id: "B",
        carrier: "gls",
        status: "available_for_pickup",
        lastUpdate: "2026-09-23T06:00:00Z",
      }),
      shipment({
        id: "C",
        carrier: "dpd",
        status: "delivered",
        lastUpdate: "2026-09-20T12:00:00Z",
      }),
      shipment({ id: "D", carrier: "dpd" }),
      shipment({ id: "E", carrier: "dpd", presumedDone: true }),
    ]),
    {
      A: { status: "available_for_pickup", shownStatus: "available_for_pickup", checkedAt: "x" },
      C: { status: "returned", shownStatus: "delivered", checkedAt: "x" },
    },
    now,
  );

  it("exclut les colis présumés terminés et les compte à part", () => {
    expect(report.global.active).toBe(4);
    expect(report.presumedDone).toBe(1);
  });

  it("mesure le marchand connu, toutes sources fusionnées", () => {
    expect(report.global.merchant).toEqual({ hits: 1, total: 4 });
  });

  it("mesure statut connu et statut juste (sur les seuls colis vérifiés)", () => {
    expect(report.global.statusKnown).toEqual({ hits: 3, total: 4 });
    expect(report.global.statusCorrect).toEqual({ hits: 1, total: 2 });
  });

  it("mesure la couverture du retrait et la fraîcheur, par transporteur", () => {
    expect(report.byCarrier["gls"]?.pickup).toEqual({
      total: 2,
      place: { hits: 1, total: 2 },
      address: { hits: 1, total: 2 },
      deadline: { hits: 0, total: 2 },
      codeOrQr: { hits: 1, total: 2 },
    });
    expect(report.byCarrier["gls"]?.medianFreshnessHours).toBe(4);
    expect(report.carrierEmailsNotUnderstood).toEqual({ "chronopost.fr": 2 });
  });
});
