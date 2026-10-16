import { Controller, Get, type INestApplication, Logger } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { SkipThrottle, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_CONTROL_MODE_TOKEN } from "./AccessControlMode.js";
import { AccessTokenVerifier } from "./AccessTokenVerifier.js";
import { UserAccessGuard } from "./UserAccessGuard.js";
import {
  RATE_LIMIT,
  UserAwareThrottlerGuard,
} from "./UserAwareThrottlerGuard.js";

@Controller("limited")
class LimitedController {
  @Get()
  public get() {
    return "ok";
  }

  @Get("free")
  @SkipThrottle()
  public free() {
    return "ok";
  }
}

const verifier = {
  verify: async (token: string | null | undefined) =>
    token?.startsWith("token-") ? { userId: token.slice(6) } : null,
};

describe("UserAwareThrottlerGuard", () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 3 }])],
      controllers: [LimitedController],
      providers: [
        { provide: AccessTokenVerifier, useValue: verifier },
        { provide: ACCESS_CONTROL_MODE_TOKEN, useValue: "observe" },
        { provide: APP_GUARD, useClass: UserAccessGuard },
        { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  const call = (path = "/limited", token?: string) => {
    const pending = request(app.getHttpServer()).get(path);
    return token ? pending.set("Authorization", `Bearer ${token}`) : pending;
  };

  it("uses a generous production limit: 120 requests per minute", () => {
    expect(RATE_LIMIT).toEqual({ ttl: 60_000, limit: 120 });
  });

  it("answers 429 with Retry-After above the limit", async () => {
    for (let i = 0; i < 3; i++) await call().expect(200);

    const response = await call().expect(429);

    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("counts each user of a valid token separately", async () => {
    for (let i = 0; i < 3; i++) await call("/limited", "token-a").expect(200);
    await call("/limited", "token-a").expect(429);

    await call("/limited", "token-b").expect(200);
  });

  it("does not limit a route marked @SkipThrottle()", async () => {
    for (let i = 0; i < 5; i++) await call("/limited/free").expect(200);
  });
});
