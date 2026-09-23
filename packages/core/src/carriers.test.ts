import { describe, expect, it } from "vitest";
import { detectTrackingNumbers, routeFor } from "./carriers.ts";

describe("detectTrackingNumbers", () => {
  it("lit le numéro dans un lien Chronopost", () => {
    const found = detectTrackingNumbers("", [
      "https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=XW123456789FR&langue=fr",
    ]);
    expect(found).toEqual([
      { carrier: "chronopost", trackingNumber: "XW123456789FR", via: "link" },
    ]);
  });

  it("lit un numéro DPD dans le chemin du lien", () => {
    const found = detectTrackingNumbers("", ["https://trace.dpd.fr/fr/trace/25012345678901"]);
    expect(found).toEqual([{ carrier: "dpd", trackingNumber: "25012345678901", via: "link" }]);
  });

  it("préfère le lien au motif pour le même numéro", () => {
    const found = detectTrackingNumbers("Votre colis XW123456789FR est en route", [
      "https://www.chronopost.fr/suivi?listeNumerosLT=XW123456789FR",
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]?.via).toBe("link");
  });

  it("reconnaît Colissimo, UPS et Amazon dans le texte", () => {
    const text = "Colissimo 6A12345678901, UPS 1Z999AA10123456784, Amazon TBA123456789012";
    expect(detectTrackingNumbers(text, []).map((c) => c.carrier)).toEqual([
      "ups",
      "colissimo",
      "amazon_logistics",
    ]);
  });

  it("n'accepte 14 chiffres comme DPD que si DPD est mentionné", () => {
    expect(detectTrackingNumbers("Référence 25012345678901", [])).toEqual([]);
    expect(detectTrackingNumbers("Livré par DPD : 25012345678901", [])[0]?.carrier).toBe("dpd");
  });

  it("ignore les liens de domaines inconnus et les URL invalides", () => {
    expect(
      detectTrackingNumbers("", ["https://exemple.com/?code=XW123456789FR", "pas une url"]),
    ).toEqual([]);
  });
});

describe("routeFor", () => {
  it("envoie le groupe La Poste vers l'API La Poste, Amazon nulle part, le reste vers l'agrégateur", () => {
    expect(routeFor("chronopost")).toBe("laposte");
    expect(routeFor("amazon_logistics")).toBe("none");
    expect(routeFor("mondial_relay")).toBe("aggregator");
  });
});
