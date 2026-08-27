import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { NotificationInternalGuard } from "./NotificationInternalGuard.js";

describe("NotificationInternalGuard", () => {
  let guard: NotificationInternalGuard;
  const mockToken = "secret-token-123";

  beforeEach(() => {
    guard = new NotificationInternalGuard();
    process.env.NOTIFICATION_INTERNAL_TOKEN = mockToken;
  });

  const createMockContext = (headerToken?: string): ExecutionContext => {
    const request = {
      headers: {
        "x-internal-token": headerToken,
      },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it("should allow activation if token matches expected token", () => {
    const context = createMockContext(mockToken);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("should throw UnauthorizedException if token is missing", () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("should throw UnauthorizedException if token does not match", () => {
    const context = createMockContext("invalid-token");
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
