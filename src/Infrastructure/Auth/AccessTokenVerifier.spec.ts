import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  AccessTokenVerifier,
  bearerToken,
  deriveAccessTokenKey,
} from "./AccessTokenVerifier.js";

const INTERNAL_TOKEN = "shared-internal-token";

// Same signing as variamos_ms_admin (NotificationAccessTokenIssuer)
const sign = (
  claims: { sub?: string; iss?: string; aud?: string; expiresIn?: string },
  key = deriveAccessTokenKey(INTERNAL_TOKEN),
  alg = "HS256",
) => {
  let jwt = new SignJWT({})
    .setProtectedHeader({ alg })
    .setIssuer(claims.iss ?? ACCESS_TOKEN_ISSUER)
    .setAudience(claims.aud ?? ACCESS_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(claims.expiresIn ?? "15m");
  if (claims.sub !== undefined) jwt = jwt.setSubject(claims.sub);
  return jwt.sign(key);
};

describe("deriveAccessTokenKey", () => {
  // Same vector in variamos_ms_admin: both services must derive the same key
  it("matches the key derivation shared with the admin service", () => {
    expect(
      Buffer.from(deriveAccessTokenKey(INTERNAL_TOKEN)).toString("hex"),
    ).toBe("a141d7e250e89f6f00473e7948c2b8eb3780a0820e9f32c9513b70ca8e2d5058");
  });
});

describe("bearerToken", () => {
  it.each([
    ["Bearer abc.def.ghi", "abc.def.ghi"],
    ["bearer   abc", "abc"],
    ["Basic abc", null],
    ["Bearer", null],
    [undefined, null],
    [["Bearer abc"], null],
  ])("reads %j as %j", (header, expected) => {
    expect(bearerToken(header)).toBe(expected);
  });
});

describe("AccessTokenVerifier", () => {
  const verifier = new AccessTokenVerifier();

  beforeEach(() => {
    vi.stubEnv("NOTIFICATION_INTERNAL_TOKEN", INTERNAL_TOKEN);
  });

  it("returns the user of a valid token", async () => {
    await expect(
      verifier.verify(await sign({ sub: "user-42" })),
    ).resolves.toEqual({ userId: "user-42" });
  });

  it.each([
    ["no token", async () => null],
    ["an expired token", () => sign({ sub: "u", expiresIn: "-1s" })],
    ["another issuer", () => sign({ sub: "u", iss: "someone-else" })],
    ["another audience", () => sign({ sub: "u", aud: "variamos_ms_admin" })],
    ["no subject", () => sign({})],
    [
      "a key derived from another secret",
      () => sign({ sub: "u" }, deriveAccessTokenKey("other-secret")),
    ],
    [
      "the internal token used as the key",
      () => sign({ sub: "u" }, new TextEncoder().encode(INTERNAL_TOKEN)),
    ],
    ["garbage", async () => "not-a-jwt"],
  ])("returns null for %s", async (_label, makeToken) => {
    await expect(verifier.verify(await makeToken())).resolves.toBeNull();
  });

  it("returns null when the internal token is not configured", async () => {
    const token = await sign({ sub: "user-42" });
    vi.stubEnv("NOTIFICATION_INTERNAL_TOKEN", "");

    await expect(verifier.verify(token)).resolves.toBeNull();
  });
});
