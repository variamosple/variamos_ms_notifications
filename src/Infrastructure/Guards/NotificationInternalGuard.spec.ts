import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationInternalGuard } from "./NotificationInternalGuard.js";

describe("NotificationInternalGuard", () => {
  let guard: NotificationInternalGuard;
  const mockToken = "secret-token-123";

  beforeEach(() => {
    guard = new NotificationInternalGuard();
    vi.stubEnv("NOTIFICATION_INTERNAL_TOKEN", mockToken);
  });

  const createMockContext = (
    headerToken?: string | string[],
  ): ExecutionContext => {
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

  it.each([
    ["does not match", "invalid-token"],
    ["only shares a prefix", `${mockToken}-longer`],
    ["is repeated in the header", [mockToken, mockToken]],
  ])("should throw UnauthorizedException if token %s", (_, headerToken) => {
    const context = createMockContext(headerToken);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("should refuse every token when none is configured", () => {
    vi.stubEnv("NOTIFICATION_INTERNAL_TOKEN", undefined);
    const context = createMockContext("any-token");
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
