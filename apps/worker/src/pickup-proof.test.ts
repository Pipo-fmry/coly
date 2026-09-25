import { describe, expect, it } from "vitest";
import { mergePickupProof } from "./sync.ts";

describe("mergePickupProof", () => {
  const newer = {
    messageId: "n",
    receivedAt: "2026-09-18T14:42:00Z",
    image: { file: "X-n", mimeType: "image/png" },
  };
  const older = { messageId: "o", receivedAt: "2026-09-17T09:00:00Z", code: "4821" };

  it("garde la preuve la plus récente, quel que soit l'ordre de lecture des emails", () => {
    expect(mergePickupProof(newer, older)).toEqual({ ...older, ...newer });
    expect(mergePickupProof(older, newer)).toEqual({ ...older, ...newer });
  });

  it("prend la preuve seule quand il n'y en a pas encore", () => {
    expect(mergePickupProof(undefined, older)).toEqual(older);
  });
});
