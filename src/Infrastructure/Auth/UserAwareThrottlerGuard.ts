import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { RequestWithPrincipal } from "./UserAccessGuard.js";

export const RATE_LIMIT = { ttl: 60_000, limit: 120 };

/**
 * Rate limit per user when the request carries a valid access token, per
 * client address otherwise. Runs after UserAccessGuard, which sets the user.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(
    request: RequestWithPrincipal & { ip?: string },
  ): Promise<string> {
    return Promise.resolve(
      request.principal
        ? `user:${request.principal.userId}`
        : `ip:${request.ip ?? "unknown"}`,
    );
  }
}
