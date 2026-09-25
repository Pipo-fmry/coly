import { describe, expect, it } from "vitest";
import { decideMailRead, merchantSender, senderName } from "./mail-filter.ts";

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

describe("merchantSender", () => {
  const from = (...domains: string[]) => domains.map((senderDomain) => ({ senderDomain }));

  it("préfère le premier expéditeur qui n'est pas un transporteur", () => {
    expect(
      merchantSender(from("network1.pickup.fr", "information.dpd.fr", "bambinou.com")),
    ).toEqual({ senderDomain: "bambinou.com" });
  });

  it("reconnaît les domaines de notification Colissimo comme transporteur", () => {
    expect(merchantSender(from("notif-colissimo-laposte.info", "undiz.com"))?.senderDomain).toBe(
      "undiz.com",
    );
  });

  it("ne renvoie rien quand seuls des transporteurs ont écrit", () => {
    expect(merchantSender(from("chronopost.fr", "chronopost.fr"))).toBeUndefined();
  });
});

describe("senderName", () => {
  it("lit le nom affiché de l'expéditeur, celui de la boutique sur une plateforme", () => {
    expect(senderName("Caats <no-reply@shopifyemail.com>")).toBe("Caats");
    expect(senderName('"La Fnac" <fnac@fnac.com>')).toBe("La Fnac");
  });

  it("ne renvoie rien sans nom affiché", () => {
    expect(senderName("noreply@chronopost.fr")).toBeUndefined();
    expect(senderName("<noreply@chronopost.fr>")).toBeUndefined();
  });
});
