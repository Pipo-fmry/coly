import { describe, expect, it } from "vitest";
import {
  carrierTrackingUrl,
  daysSince,
  isMeaningfulPlace,
  isPresumedDone,
  mergeTimeline,
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
