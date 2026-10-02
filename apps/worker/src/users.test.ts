import { randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const key = randomBytes(32);
const now = new Date("2026-10-02T10:00:00Z");
const alice = { identity: { id: "1001", email: "alice@example.com" }, refreshToken: "rt-alice" };
const bob = { identity: { id: "1002", email: "bob@example.com" }, refreshToken: "rt-bob" };

// Le dossier de données est fixé à l'import de paths.ts : on le pointe sur un dossier temporaire avant.
let users: typeof import("./users.ts");
beforeAll(async () => {
  process.env["COLY_DATA_DIR"] = await mkdtemp(join(tmpdir(), "coly-users-"));
  users = await import("./users.ts");
});

describe("users", () => {
  it("crée un compte par consentement et isole les tokens par utilisateur", async () => {
    const profile = await users.saveGrant(alice, key, now);
    await users.saveGrant(bob, key, now);
    expect(profile).toEqual({
      id: "1001",
      email: "alice@example.com",
      createdAt: now.toISOString(),
    });
    expect(await users.readRefreshToken("1001", key)).toBe("rt-alice");
    expect(await users.readRefreshToken("1002", key)).toBe("rt-bob");
    expect(await users.readRefreshToken("1003", key)).toBeUndefined();
  });

  it("garde la date de création et remplace le token à une nouvelle connexion", async () => {
    const later = new Date("2026-10-09T10:00:00Z");
    const profile = await users.saveGrant({ ...alice, refreshToken: "rt-alice-2" }, key, later);
    expect(profile.createdAt).toBe(now.toISOString());
    expect(await users.readRefreshToken("1001", key)).toBe("rt-alice-2");
  });

  it("retrouve un utilisateur par email, sans tenir compte de la casse", async () => {
    expect((await users.findUserByEmail("Bob@Example.com"))?.id).toBe("1002");
    expect(await users.findUserByEmail("inconnu@example.com")).toBeUndefined();
    expect((await users.listUsers()).map((u) => u.id).sort()).toEqual(["1001", "1002"]);
  });

  it("refuse un identifiant qui sortirait du dossier des utilisateurs", () => {
    expect(() => users.userDir("../autre")).toThrow();
    expect(() => users.userDir("")).toThrow();
    expect(users.userStateFile("1001")).toMatch(/users[\\/]1001[\\/]state\.json$/);
  });

  it("supprime toutes les données d'un compte sans toucher aux autres", async () => {
    await users.deleteUserData("1001");
    expect(await users.readProfile("1001")).toBeUndefined();
    expect(await users.readRefreshToken("1001", key)).toBeUndefined();
    expect((await users.readProfile("1002"))?.email).toBe("bob@example.com");
  });
});
