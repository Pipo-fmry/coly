import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session.ts";

const secret = randomBytes(32);
const now = new Date("2026-10-02T10:00:00Z");
const userId = "1234567890";

describe("session", () => {
  it("signe puis relit une session avant son expiration", () => {
    const token = signSession(secret, userId, now, 60_000);
    expect(verifySession(secret, token, new Date(now.getTime() + 59_000))).toBe(userId);
  });

  it("refuse un jeton expiré", () => {
    const token = signSession(secret, userId, now, 60_000);
    expect(verifySession(secret, token, new Date(now.getTime() + 60_000))).toBeUndefined();
  });

  it("refuse un jeton altéré, signé avec un autre secret ou mal formé", () => {
    const token = signSession(secret, userId, now, 60_000);
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "autre", x: 2e12 })).toString("base64url");
    expect(verifySession(secret, `${forged}.${signature}`, now)).toBeUndefined();
    expect(verifySession(randomBytes(32), token, now)).toBeUndefined();
    expect(verifySession(secret, `${payload}`, now)).toBeUndefined();
    expect(verifySession(secret, "", now)).toBeUndefined();
  });
});
