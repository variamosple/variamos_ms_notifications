import { SetMetadata } from "@nestjs/common";

export const SKIP_USER_ACCESS_CHECK = "skipUserAccessCheck";

/**
 * Marks a route that does not take a user access token: the health check,
 * and the internal routes protected by the internal token.
 */
export const SkipUserAccessCheck = () =>
  SetMetadata(SKIP_USER_ACCESS_CHECK, true);
