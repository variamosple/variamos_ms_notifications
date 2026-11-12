import type { Principal } from "../../Domain/Entities/Principal.js";

/**
 * The recipient of a user route is the verified user of the access token.
 * The `recipientId` query parameter is only read for a request without a
 * valid token, in observe mode (ADR-0001), and is ignored otherwise.
 */
export function recipientOf(
  principal: Principal | undefined,
  recipientId: string | undefined,
): string | undefined {
  return principal ? principal.userId : recipientId;
}
