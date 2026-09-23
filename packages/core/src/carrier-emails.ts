/**
 * Lecture déterministe des emails envoyés par les transporteurs (ADR 0015) : ce sont souvent les seuls à donner
 * le point de retrait exact, la date de mise à disposition et le QR code. Un gabarit par transporteur, testé sur
 * des fixtures anonymisées. Pas d'IA ici : si le gabarit ne reconnaît pas l'email, on ne devine pas.
 */

import type { DetectedCarrier } from "./carriers.ts";

export type CarrierEmailKind = "in_transit" | "available_for_pickup";

export interface CarrierEmailInfo {
  carrier: DetectedCarrier;
  trackingNumber: string;
  kind: CarrierEmailKind;
  merchant?: string;
  pickupPoint?: { name: string; address?: string };
  /** Date annoncée de mise à disposition (JJ/MM), quand l'email arrive avant le colis. */
  availableOn?: string;
  /** L'email contient un QR code de retrait (affiché tel quel, jamais régénéré). */
  hasPickupQrCode: boolean;
}

interface EmailInput {
  from: string;
  subject: string;
  text: string;
}

/** GLS France : « Votre colis arrive bientôt » et « Votre colis est disponible en Relais GLS ». */
function parseGls({ from, subject, text }: EmailInput): CarrierEmailInfo | undefined {
  if (!/@([a-z0-9-]+\.)*gls-(france\.com|group\.eu|group\.com)>?$/i.test(from.trim()))
    return undefined;
  const block =
    /Numéro de colis\s+([0-9A-Z]{8,14})\s+Expéditeur\s+(.+?)\s+Relais GLS\s+(.+?)\s+Vous avez une question/i.exec(
      text,
    );
  if (!block?.[1]) return undefined;
  const [, trackingNumber, merchant, relay] = block;

  const info: CarrierEmailInfo = {
    carrier: "gls",
    trackingNumber,
    kind: /disponible/i.test(subject) ? "available_for_pickup" : "in_transit",
    hasPickupQrCode: /QR code/i.test(text),
  };
  if (merchant) info.merchant = merchant.trim();
  if (relay) {
    // « EXPRESS MARKET 125 COURS LIEUTAUD 13006 Marseille » : le nom s'arrête au numéro de rue.
    const split = /^(.+?)\s+(\d+[\s,].*\d{5}.*)$/.exec(relay.trim());
    info.pickupPoint = split?.[1]
      ? { name: split[1], ...(split[2] && { address: split[2] }) }
      : { name: relay.trim() };
  }
  const announced = /sera disponible le (\d{2}\/\d{2})/i.exec(text)?.[1];
  if (announced) info.availableOn = announced;
  return info;
}

const PARSERS = [parseGls];

export function parseCarrierEmail(email: EmailInput): CarrierEmailInfo | undefined {
  for (const parse of PARSERS) {
    const info = parse(email);
    if (info) return info;
  }
  return undefined;
}
