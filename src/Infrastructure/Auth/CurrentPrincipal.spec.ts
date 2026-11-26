import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { principalOf } from "./CurrentPrincipal.js";

describe("principalOf", () => {
  it("gives the verified user of the request", () => {
    const request = {
      method: "GET",
      headers: {},
      principal: { userId: "u-1" },
    };

    expect(principalOf(request)).toEqual({ userId: "u-1" });
  });

  // A route that skips UserAccessGuard has no user: it must not read one
  it("refuses a request without a verified user", () => {
    expect(() => principalOf({ method: "GET", headers: {} })).toThrow(
      UnauthorizedException,
    );
  });
});
