import { describe, expect, it } from "vitest";
import { findPickupCode, pickupImages } from "./pickup.ts";

describe("findPickupCode", () => {
  it("lit un code de retrait écrit en clair, quelle que soit la tournure", () => {
    expect(findPickupCode("Votre code de retrait : 482913. Présentez-le au relais.")).toBe(
      "482913",
    );
    expect(findPickupCode("Code PIN 4821 à donner au commerçant")).toBe("4821");
    expect(findPickupCode("Votre code de sécurité est A7K2P9")).toBe("A7K2P9");
    expect(findPickupCode("code de validation: 55 81 23")).toBe("558123");
  });

  it("ne prend pas un mot ou un code promo pour un code de retrait", () => {
    expect(findPickupCode("Utilisez le code promo BIENVENUE10")).toBeUndefined();
    expect(findPickupCode("Code de retrait : présentez le QR code ci-dessous")).toBeUndefined();
  });
});

describe("pickupImages", () => {
  const img = (hint: string) => ({ hint });

  it("choisit l'image qui porte un QR ou un code-barres", () => {
    expect(pickupImages([img("logo.png"), img("cid:qrcode_123"), img("footer.gif")])).toEqual([
      img("cid:qrcode_123"),
    ]);
    expect(pickupImages([img("https://cdn.example/barcode?id=9")])).toEqual([
      img("https://cdn.example/barcode?id=9"),
    ]);
    expect(pickupImages([img("Code-barres de retrait")])).toEqual([img("Code-barres de retrait")]);
  });

  it("ne choisit rien quand aucune image n'est un code", () => {
    expect(pickupImages([img("logo.png"), img("https://cdn.example/banner.jpg")])).toEqual([]);
  });
});
