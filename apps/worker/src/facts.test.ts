import { fuseMerchant, fusePlace } from "@coly/core";
import { describe, expect, it } from "vitest";
import { merchantFacts, placeFacts } from "./facts.ts";
import type { ShipmentState, Sighting } from "./sync.ts";

const shipment = (s: Partial<ShipmentState>): ShipmentState => ({
  id: "X1",
  candidate: { carrier: "chronopost", trackingNumber: "X1", via: "pattern" },
  sightings: [{ date: "2026-09-24", senderDomain: "chronopost.fr", messageId: "c1" }],
  carrierEmails: [],
  snapshots: [],
  status: "in_transit",
  ...s,
});

const orphan = (date: string, senderDomain: string, senderName?: string): Sighting => ({
  date,
  senderDomain,
  messageId: `o-${senderDomain}`,
  ...(senderName && { senderName }),
});

const tracked = (label: string, location?: string): Partial<ShipmentState> => ({
  snapshots: [
    {
      source: "ship24",
      trackingNumber: "X1",
      found: true,
      fetchedAt: "2026-09-25T00:00:00Z",
      events: [{ label, at: "2026-09-24T19:01:00Z", ...(location && { location }) }],
      relatedNumbers: [],
    },
  ],
});

describe("merchantFacts", () => {
  it("croise le suivi et l'email marchand sans numéro reçu la veille", () => {
    const s = shipment(tracked("Shipment in preparation to be shipped", "FNAC LOGISTIQUE"));
    expect(
      fuseMerchant(merchantFacts(s, [orphan("2026-09-23", "fnac.com", "Fnac")])),
    ).toMatchObject({
      value: "Fnac",
      confidence: "certain",
    });
  });

  it("ignore un email sans numéro trop ancien, d'un transporteur ou d'une personne", () => {
    const s = shipment({});
    expect(
      merchantFacts(s, [
        orphan("2026-09-10", "fnac.com", "Fnac"),
        orphan("2026-09-24", "dpd.fr"),
        orphan("2026-09-24", "gmail.com", "Olivier"),
      ]),
    ).toEqual([]);
  });

  it("ne prend pas pour marchand une personne qui transfère l'email du colis", () => {
    const s = shipment({
      sightings: [
        { date: "2026-09-20", senderDomain: "gmail.com", senderName: "Olivier", messageId: "f" },
      ],
    });
    expect(merchantFacts(s, [])).toEqual([]);
  });

  it("prend l'expéditeur d'un email qui cite le numéro, nom affiché d'abord", () => {
    const s = shipment({
      sightings: [
        {
          date: "2026-09-20",
          senderDomain: "t.shopifyemail.com",
          senderName: "Caats",
          messageId: "m",
        },
      ],
    });
    expect(fuseMerchant(merchantFacts(s, []))?.value).toBe("Caats");
  });
});

describe("placeFacts", () => {
  it("fait primer le relais de l'email transporteur sur le lieu de l'agrégateur", () => {
    const s = shipment({
      carrierEmails: [
        {
          messageId: "g",
          receivedAt: "2026-09-18T14:42:00Z",
          kind: "available_for_pickup",
          hasPickupQrCode: true,
          pickupPoint: { name: "EXPRESS MARKET", address: "125 COURS LIEUTAUD 13006 Marseille" },
        },
      ],
      snapshots: [
        {
          source: "ship24",
          trackingNumber: "X1",
          found: true,
          fetchedAt: "2026-09-25T00:00:00Z",
          events: [],
          relatedNumbers: [],
          removalPoint: { name: "MARSEILLE PPDC" },
        },
      ],
    });
    expect(fusePlace(placeFacts(s))?.value).toEqual({
      name: "EXPRESS MARKET",
      address: "125 COURS LIEUTAUD 13006 Marseille",
    });
  });
});

describe("placeFacts — lieu écrit dans le libellé du suivi", () => {
  it("retient le relais de mise à disposition, pas l'agence ni un événement sans lieu", () => {
    const events = [
      {
        label: "Recipient informed by SMS or email",
        at: "2026-09-25T12:52:00",
        location: "MARSEILLE - FR - SHOP N  FOOD",
      },
      {
        label: "Colis mis à disposition au point de retrait",
        code: "delivery_available_for_pickup",
        at: "2026-09-25T11:50:00+02:00",
      },
      {
        label: "Available at retrieval point",
        code: "delivery_available_for_pickup",
        at: "2026-09-25T11:50:00",
        location: "MARSEILLE - FR - SHOP N  FOOD",
      },
      {
        label: "Shipment left at receiver's disposal at local post office or Parcel shop",
        code: "delivery_available_for_pickup",
        at: "2026-09-25T11:44:00",
        location: "MARSEILLE CENTRE CHRONOPOST",
      },
    ];
    const s = shipment({
      snapshots: [
        {
          source: "ship24",
          trackingNumber: "X1",
          found: true,
          fetchedAt: "2026-09-25T13:00:00Z",
          events,
          relatedNumbers: [],
        },
      ],
    });
    expect(fusePlace(placeFacts(s))?.value).toEqual({ name: "SHOP N FOOD", locality: "MARSEILLE" });
  });
});
