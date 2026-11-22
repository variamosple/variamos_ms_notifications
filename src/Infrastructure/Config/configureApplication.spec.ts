import { Module } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { configureApplication } from "./configureApplication.js";

@Module({})
class EmptyModule {}

const createApplication = async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [EmptyModule],
  }).compile();
  return moduleRef.createNestApplication<NestExpressApplication>();
};

// No real signal here: Nest sends it again to the process once closed,
// which would end the test runner. The listeners show it is followed.
describe("configureApplication shutdown (ADM-N21)", () => {
  it("shuts the application down on SIGTERM and SIGINT", async () => {
    const app = await createApplication();
    const before = {
      term: process.listenerCount("SIGTERM"),
      int: process.listenerCount("SIGINT"),
    };

    configureApplication(app);
    await app.init();

    expect(process.listenerCount("SIGTERM")).toBe(before.term + 1);
    expect(process.listenerCount("SIGINT")).toBe(before.int + 1);
    await app.close();
  });

  it("stops listening for the signals once closed", async () => {
    const app = await createApplication();
    const before = process.listenerCount("SIGTERM");
    configureApplication(app);
    await app.init();

    await app.close();

    expect(process.listenerCount("SIGTERM")).toBe(before);
  });
});
