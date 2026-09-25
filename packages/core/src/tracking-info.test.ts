import { describe, expect, it } from "vitest";
import {
  carrierTrackingUrl,
  daysSince,
  isMeaningfulPlace,
  isPresumedDone,
  mergeTimeline,
  normalizeEvent,
  parseEventPlace,
} from "./tracking-info.ts";

const now = new Date("2026-09-23T12:00:00Z");

describe("carrierTrackingUrl", () => {
  it("construit la page officielle du transporteur et encode le numéro", () => {
    expect(carrierTrackingUrl("gls", "12345678901")).toBe(
      "https://gls-group.eu/FR/fr/suivi-colis?match=12345678901",
    );
    expect(carrierTrackingUrl("dpd", "a b")).toContain("a%20b");
  });

  it("ne renvoie rien quand il n'existe pas de page publique", () => {
    expect(carrierTrackingUrl("amazon_logistics", "TBA1")).toBeUndefined();
  });
});

describe("isMeaningfulPlace", () => {
  it("refuse un simple code pays ou un lieu vide", () => {
    expect(isMeaningfulPlace("FR")).toBe(false);
    expect(isMeaningfulPlace(" ")).toBe(false);
    expect(isMeaningfulPlace(undefined)).toBe(false);
    expect(isMeaningfulPlace("MARSEILLE 06")).toBe(true);
  });
});

describe("mergeTimeline", () => {
  it("fusionne les sources, retire les doublons et trie du plus récent au plus ancien", () => {
    const merged = mergeTimeline([
      { source: "ship24", label: "Pris en charge", at: "2026-09-15T08:00:00" },
      { source: "laposte", label: "Pris en charge", at: "2026-09-15T08:00:30" },
      { source: "ship24", label: "Disponible au relais", at: "2026-09-18T14:19:00" },
    ]);
    expect(merged.map((e) => e.label)).toEqual(["Disponible au relais", "Pris en charge"]);
  });
});

describe("ancienneté", () => {
  it("compte les jours écoulés", () => {
    expect(daysSince("2026-09-18T14:19:00Z", now)).toBe(4);
  });

  it("présume terminé un colis ancien sans statut, jamais un colis suivi", () => {
    expect(isPresumedDone("2026-07-01", false, now)).toBe(true);
    expect(isPresumedDone("2026-07-01", true, now)).toBe(false);
    expect(isPresumedDone("2026-09-10", false, now)).toBe(false);
  });
});

describe("normalizeEvent", () => {
  it("sort le lieu écrit en tête du libellé (« LIEU, message »)", () => {
    expect(
      normalizeEvent({ label: "MARSEILLE - FR - SHOP N  FOOD, Available at retrieval point" }),
    ).toEqual({ label: "Available at retrieval point", location: "MARSEILLE - FR - SHOP N  FOOD" });
    expect(
      normalizeEvent({ label: "FNAC LOGISTIQUE, Shipment in preparation to be shipped" }),
    ).toEqual({
      label: "Shipment in preparation to be shipped",
      location: "FNAC LOGISTIQUE",
    });
  });

  it("ne touche ni une phrase ordinaire, ni un événement qui a déjà un lieu, et reste stable", () => {
    const sentence = { label: "Votre colis est livré, merci de votre confiance" };
    expect(normalizeEvent(sentence)).toEqual(sentence);
    const located = { label: "HUB PARIS, Tri effectué", location: "PARIS" };
    expect(normalizeEvent(located)).toEqual(located);
    const once = normalizeEvent({
      label: "MARSEILLE CENTRE CHRONOPOST, Sorted at delivery location",
    });
    expect(normalizeEvent(once)).toEqual(once);
  });
});

describe("parseEventPlace", () => {
  it("décompose « VILLE - PAYS - NOM » et nettoie les espaces", () => {
    expect(parseEventPlace("MARSEILLE - FR - SHOP N  FOOD")).toEqual({
      name: "SHOP N FOOD",
      locality: "MARSEILLE",
    });
  });

  it("garde un nom simple tel quel", () => {
    expect(parseEventPlace("EXPRESS MARKET")).toEqual({ name: "EXPRESS MARKET" });
  });
});
