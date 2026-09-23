import { describe, expect, it } from "vitest";
import { decideMailRead } from "./mail-filter.ts";

const read = (from: string, subject: string) => decideMailRead({ from, subject });

describe("decideMailRead", () => {
  it("lit toujours les emails des transporteurs", () => {
    expect(read("Chronopost <noreply@chronopost.fr>", "Votre colis vous attend")).toEqual({
      read: true,
      reason: "carrier_sender",
    });
    expect(read("Mondial Relay <info@notification.mondialrelay.fr>", "Offre spéciale").read).toBe(
      true,
    );
  });

  it("lit les emails transactionnels des marchands", () => {
    expect(
      read("Undiz <noreply@undiz.com>", "Votre commande n°211258160 a été expédiée").read,
    ).toBe(true);
    expect(read("Zalando <info@zalando.fr>", "Ton colis est en route").read).toBe(true);
  });

  it("ne lit jamais le marketing, même avec un mot-clé de livraison", () => {
    expect(read("Zara <news@zara.com>", "Livraison offerte ce week-end")).toEqual({
      read: false,
      reason: "marketing",
    });
    expect(read("Fnac <news@fnac.com>", "Soldes : -50 % et livraison rapide").read).toBe(false);
  });

  it("ne lit pas les demandes d'avis sur une commande", () => {
    expect(read("Boutique <avis@boutique.fr>", "Donnez votre avis sur votre commande")).toEqual({
      read: false,
      reason: "feedback",
    });
  });

  it("ne lit pas ce qui n'est pas lié à une commande", () => {
    expect(read("Banque <info@banque.fr>", "Votre relevé de compte")).toEqual({
      read: false,
      reason: "not_transactional",
    });
  });
});

describe("decideMailRead — robustesse", () => {
  it("reste rapide sur un en-tête hostile très long", () => {
    const start = performance.now();
    decideMailRead({ from: `a@${"9".repeat(50_000)}.fr`, subject: "9".repeat(50_000) });
    expect(performance.now() - start).toBeLessThan(50);
  });
});
