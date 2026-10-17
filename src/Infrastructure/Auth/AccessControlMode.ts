/**
 * How user access tokens are enforced (ADR-0001):
 * - "observe": a request or socket without a valid token is logged and keeps
 *   the previous behaviour, while clients move to access tokens;
 * - "enforce": it is refused.
 */
export type AccessControlMode = "observe" | "enforce";

export const ACCESS_CONTROL_MODE_TOKEN = "ACCESS_CONTROL_MODE";

// Enforced since variamos-components 0.2.3 sends access tokens (ADR-0001)
export const ACCESS_CONTROL_MODE: AccessControlMode = "enforce";
