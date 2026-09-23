import { describe, expect, it } from "vitest";
import { parseCarrierEmail } from "./carrier-emails.ts";

// Fixtures anonymisées, reproduisant la structure réelle des emails GLS France (septembre 2026).
const GLS_AVAILABLE = `Bonjour, votre colis vous attend Bonne nouvelle : votre colis Boutique Test est disponible dans le Relais GLS SHOP TEST . Présentez le QR code ci-dessous lors de votre passage en Relais GLS : A défaut, munissez-vous d'une pièce d'identité. Bon à savoir Si plusieurs colis du même expéditeur sont disponibles le même jour, un seul QR code suffit pour retirer l'ensemble. Numéro de colis 00TESTAB Expéditeur Boutique Test Relais GLS SHOP TEST 12 RUE DE L EXEMPLE 13006 Marseille Vous avez une question ?`;

const GLS_SOON = `Bonjour, votre colis est en route Bonne nouvelle : votre colis Boutique Test est en cours d'acheminement et sera disponible le 18/09 dans le relais GLS Suivre mon colis Numéro de colis 00TESTAB Expéditeur Boutique Test Relais GLS SHOP TEST 12 RUE DE L EXEMPLE 13006 Marseille Vous avez une question ?`;

describe("parseCarrierEmail — GLS France", () => {
  it("lit le relais, l'adresse, le marchand et la présence du QR code", () => {
    expect(
      parseCarrierEmail({
        from: "GLS France <noreply@gls-france.com>",
        subject: "Votre colis est disponible en Relais GLS",
        text: GLS_AVAILABLE,
      }),
    ).toEqual({
      carrier: "gls",
      trackingNumber: "00TESTAB",
      kind: "available_for_pickup",
      merchant: "Boutique Test",
      pickupPoint: { name: "SHOP TEST", address: "12 RUE DE L EXEMPLE 13006 Marseille" },
      hasPickupQrCode: true,
    });
  });

  it("lit l'annonce avant arrivée : relais de destination et date prévue", () => {
    const info = parseCarrierEmail({
      from: "GLS <noreply@gls-france.com>",
      subject: "Votre colis arrive bientôt",
      text: GLS_SOON,
    });
    expect(info?.kind).toBe("in_transit");
    expect(info?.availableOn).toBe("18/09");
    expect(info?.pickupPoint?.name).toBe("SHOP TEST");
    expect(info?.hasPickupQrCode).toBe(false);
  });

  it("ignore un email qui n'est pas de GLS, même avec le même texte", () => {
    expect(
      parseCarrierEmail({ from: "x@exemple.fr", subject: "Votre colis", text: GLS_AVAILABLE }),
    ).toBeUndefined();
  });
});
