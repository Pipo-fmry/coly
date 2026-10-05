import { describe, expect, it } from "vitest";
import { authorizationUrl, identityFromIdToken } from "./oauth.ts";

const idToken = (claims: Record<string, unknown>) =>
  ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");

const valid = {
  iss: "https://accounts.google.com",
  aud: "client-id",
  sub: "1234567890",
  email: "Testeur@Example.com",
  email_verified: true,
};

describe("identityFromIdToken", () => {
  it("renvoie l'identifiant Google et l'email en minuscules", () => {
    expect(identityFromIdToken(idToken(valid), "client-id")).toEqual({
      id: "1234567890",
      email: "testeur@example.com",
    });
  });

  it("refuse un autre émetteur, une autre audience ou un email non vérifié", () => {
    expect(() =>
      identityFromIdToken(idToken({ ...valid, iss: "https://evil" }), "client-id"),
    ).toThrow();
    expect(() => identityFromIdToken(idToken(valid), "autre-client")).toThrow();
    expect(() =>
      identityFromIdToken(idToken({ ...valid, email_verified: false }), "client-id"),
    ).toThrow();
    expect(() => identityFromIdToken("abc", "client-id")).toThrow();
  });
});

describe("authorizationUrl", () => {
  it("demande identité et Gmail en lecture seule, hors ligne, avec PKCE", () => {
    const url = new URL(
      authorizationUrl(
        { clientId: "client-id", clientSecret: "s" },
        { redirectUri: "https://coly.example/api/auth/callback", state: "st", challenge: "ch" },
      ),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe(
      "openid email https://www.googleapis.com/auth/gmail.readonly",
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("redirect_uri")).toBe("https://coly.example/api/auth/callback");
  });
});
