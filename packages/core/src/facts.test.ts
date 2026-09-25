import { describe, expect, it } from "vitest";
import {
  fuseMerchant,
  fusePlace,
  type MerchantFact,
  type PlaceFact,
  shipperFromEvent,
} from "./facts.ts";

const merchant = (
  value: string,
  kind: MerchantFact["kind"],
  confidence: MerchantFact["confidence"] = "certain",
): MerchantFact => ({ field: "merchant", value, kind, confidence, sourceRef: `${kind}:${value}` });

describe("fuseMerchant", () => {
  it("retient un fait certain plutôt qu'un fait probable", () => {
    expect(
      fuseMerchant([
        merchant("Zalando", "nearby_email", "probable"),
        merchant("Caats", "carrier_email"),
      ]),
    ).toMatchObject({ value: "Caats", confidence: "certain" });
  });

  it("confirme deux faits probables concordants et garde le nom le plus lisible", () => {
    expect(
      fuseMerchant([
        merchant("FNAC LOGISTIQUE", "aggregator", "probable"),
        merchant("Fnac", "nearby_email", "probable"),
      ]),
    ).toEqual({
      value: "Fnac",
      confidence: "certain",
      sources: ["aggregator:FNAC LOGISTIQUE", "nearby_email:Fnac"],
    });
  });

  it("préfère un nom écrit normalement à un nom tout en capitales", () => {
    expect(
      fuseMerchant([merchant("CAATS", "sender"), merchant("Caats", "carrier_email")])?.value,
    ).toBe("Caats");
  });

  it("garde un fait probable seul, marqué comme tel", () => {
    expect(fuseMerchant([merchant("FNAC LOGISTIQUE", "aggregator", "probable")])).toMatchObject({
      value: "FNAC LOGISTIQUE",
      confidence: "probable",
    });
  });

  it("ne tranche pas entre deux emails voisins contradictoires sans autre indice", () => {
    expect(
      fuseMerchant([
        merchant("Fnac", "nearby_email", "probable"),
        merchant("Decathlon", "nearby_email", "probable"),
      ]),
    ).toBeUndefined();
  });

  it("départage des emails voisins par un autre indice concordant", () => {
    expect(
      fuseMerchant([
        merchant("Decathlon", "nearby_email", "probable"),
        merchant("Fnac", "nearby_email", "probable"),
        merchant("FNAC LOGISTIQUE", "aggregator", "probable"),
      ]),
    ).toMatchObject({ value: "Fnac", confidence: "certain" });
  });

  it("entre deux faits certains contradictoires de même force, garde le premier observé", () => {
    expect(
      fuseMerchant([merchant("Zalando", "sender"), merchant("Decathlon", "sender")])?.value,
    ).toBe("Zalando");
  });

  it("ne répète pas une même source", () => {
    expect(
      fuseMerchant([
        { ...merchant("Caats", "sender"), sourceRef: "email caats.co" },
        { ...merchant("Caats", "sender"), sourceRef: "email caats.co" },
      ])?.sources,
    ).toEqual(["email caats.co"]);
  });

  it("ne renvoie rien sans fait", () => {
    expect(fuseMerchant([])).toBeUndefined();
  });
});

const place = (
  name: string,
  kind: PlaceFact["kind"],
  extra: Partial<PlaceFact> = {},
): PlaceFact => ({
  field: "place",
  value: { name },
  kind,
  confidence: "certain",
  sourceRef: kind,
  ...extra,
});

describe("fusePlace", () => {
  it("préfère le lieu le plus précis : email transporteur, puis API officielle, puis agrégateur", () => {
    expect(
      fusePlace([place("MARSEILLE PPDC", "aggregator"), place("EXPRESS MARKET", "carrier_email")]),
    )?.toMatchObject({ value: { name: "EXPRESS MARKET" } });
  });

  it("à précision égale, prend le plus récent", () => {
    expect(
      fusePlace([
        place("RELAIS A", "carrier_email", { observedAt: "2026-09-20T10:00:00Z" }),
        place("RELAIS B", "carrier_email", { observedAt: "2026-09-22T10:00:00Z" }),
      ]),
    )?.toMatchObject({ value: { name: "RELAIS B" } });
  });

  it("écarte un lieu inexploitable", () => {
    expect(fusePlace([place("FR", "aggregator")])).toBeUndefined();
  });
});

describe("shipperFromEvent", () => {
  it("lit l'expéditeur : lieu d'un événement de préparation, ou nommé dans le libellé", () => {
    expect(
      shipperFromEvent({
        label: "Shipment in preparation to be shipped",
        location: "FNAC LOGISTIQUE",
      }),
    ).toBe("FNAC LOGISTIQUE");
    expect(shipperFromEvent({ label: "Expéditeur : Maison du Monde" })).toBe("Maison du Monde");
  });

  it("ne prend pas une phrase générique ni un lieu de transit pour un nom", () => {
    expect(
      shipperFromEvent({ label: "Colis en cours de préparation chez l'expéditeur" }),
    ).toBeUndefined();
    expect(
      shipperFromEvent({ label: "Colis livré", location: "MARSEILLE CENTRE" }),
    ).toBeUndefined();
    expect(
      shipperFromEvent({
        label: "Shipment in preparation to be shipped",
        location: "WEB SERVICES",
      }),
    ).toBeUndefined();
  });
});
