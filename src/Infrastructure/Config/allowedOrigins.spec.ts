import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HTTP_CORS_OPTIONS, isAllowedOrigin } from "./allowedOrigins.js";

describe("isAllowedOrigin", () => {
  it.each([
    "https://app.variamos.com",
    "http://localhost:3000",
    "http://localhost",
    "http://127.0.0.1:5173",
  ])("allows %s", (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true);
  });

  it.each([
    "https://evil.example.com",
    "http://app.variamos.com",
    "https://app.variamos.com.evil.example.com",
    "http://localhost.evil.example.com",
    "https://localhost:3000",
    "null",
  ])("refuses %s", (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });
});

@Controller("ping")
class PingController {
  @Get()
  public ping() {
    return "pong";
  }
}

describe("HTTP CORS options", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.enableCors(HTTP_CORS_OPTIONS);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows the admin UI origin, with credentials", async () => {
    const response = await request(app.getHttpServer())
      .get("/ping")
      .set("Origin", "https://app.variamos.com");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://app.variamos.com",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not allow another origin", async () => {
    const response = await request(app.getHttpServer())
      .options("/ping")
      .set("Origin", "https://evil.example.com")
      .set("Access-Control-Request-Method", "GET");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
