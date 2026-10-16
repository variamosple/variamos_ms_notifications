import { hkdfSync } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { jwtVerify } from "jose";
import type { Principal } from "../../Domain/Entities/Principal.js";

// Shared with variamos_ms_admin, which issues the tokens (ADR-0001).
// Changing one value breaks every token.
export const ACCESS_TOKEN_ISSUER = "variamos_ms_admin";
export const ACCESS_TOKEN_AUDIENCE = "variamos_ms_notifications";
const KEY_SALT = "variamos-notifications";
const KEY_INFO = "user-access-token:v1";

/**
 * Verification key derived from the internal token both services share:
 * the internal token itself never verifies a user token.
 */
export function deriveAccessTokenKey(internalToken: string): Uint8Array {
  return new Uint8Array(
    hkdfSync("sha256", internalToken, KEY_SALT, KEY_INFO, 32),
  );
}

/** Token of an `Authorization: Bearer <token>` header, if any. */
export function bearerToken(header: unknown): string | null {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

@Injectable()
export class AccessTokenVerifier {
  private readonly logger = new Logger(AccessTokenVerifier.name);

  /**
   * Returns the user of a valid access token, or null for a missing,
   * expired, forged or foreign token.
   */
  public async verify(
    token: string | null | undefined,
  ): Promise<Principal | null> {
    if (!token) return null;
    const internalToken = process.env.NOTIFICATION_INTERNAL_TOKEN;
    if (!internalToken) {
      this.logger.error(
        "NOTIFICATION_INTERNAL_TOKEN is not set: access tokens cannot be verified",
      );
      return null;
    }
    try {
      const { payload } = await jwtVerify(
        token,
        deriveAccessTokenKey(internalToken),
        {
          issuer: ACCESS_TOKEN_ISSUER,
          audience: ACCESS_TOKEN_AUDIENCE,
          algorithms: ["HS256"],
        },
      );
      return typeof payload.sub === "string" && payload.sub !== ""
        ? { userId: payload.sub }
        : null;
    } catch {
      return null;
    }
  }
}
