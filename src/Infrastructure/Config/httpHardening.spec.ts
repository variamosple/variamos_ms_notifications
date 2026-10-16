import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyHttpHardening } from "./httpHardening.js";

@Controller("probe")
class ProbeController {
  @Get("ip")
  public ip(@Req() req: { ip?: string }) {
    return { ip: req.ip };
  }

  @Post("echo")
  public echo(@Body() body: unknown) {
    return { received: body !== undefined };
  }
}

describe("applyHttpHardening", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    applyHttpHardening(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("sends the helmet security headers", async () => {
    const response = await request(app.getHttpServer()).get("/probe/ip");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("answers 413 for a JSON body above 100 kB", async () => {
    await request(app.getHttpServer())
      .post("/probe/echo")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ text: "x".repeat(101 * 1024) }))
      .expect(413);
  });

  it("accepts a JSON body below the limit", async () => {
    await request(app.getHttpServer())
      .post("/probe/echo")
      .send({ text: "x".repeat(50 * 1024) })
      .expect(201);
  });

  it("reads the client address forwarded by a proxy on a private address", async () => {
    // supertest connects from 127.0.0.1, a trusted (loopback) proxy address
    const response = await request(app.getHttpServer())
      .get("/probe/ip")
      .set("X-Forwarded-For", "203.0.113.7");

    expect(response.body.ip).toBe("203.0.113.7");
  });
});
