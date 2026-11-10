import { afterEach, describe, expect, it, vi } from "vitest";
import { REQUIRED_IN_PRODUCTION, validateEnv } from "./env.config.js";

// Every variable the service reads, as the server sets them
const SERVER_ENV = {
  NODE_ENV: "production",
  PORT: "3001",
  NOTIFICATION_INTERNAL_TOKEN: "test-internal-token",
  DATABASE_HOST: "db",
  DATABASE_PORT: "5433",
  DATABASE_USERNAME: "notifications",
  DATABASE_PASSWORD: "test-password",
  DATABASE_NAME: "notifications",
  DATABASE_SCHEMA: "variamos",
  DATABASE_SSL: "true",
};

const stubEnv = (env: Record<string, string | undefined>) => {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
};

describe("validateEnv", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the server variables, numbers and SSL flag converted", () => {
    stubEnv(SERVER_ENV);

    expect(validateEnv()).toEqual({
      ...SERVER_ENV,
      PORT: 3001,
      DATABASE_PORT: 5433,
      DATABASE_SSL: true,
    });
  });

  it.each([
    ["false", false],
    [undefined, false],
  ])("turns DATABASE_SSL=%s into %s", (value, expected) => {
    stubEnv({ ...SERVER_ENV, DATABASE_SSL: value });

    expect(validateEnv().DATABASE_SSL).toBe(expected);
  });

  const expectStop = (variable: string) => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => validateEnv()).toThrow("exit");
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(
      "Invalid environment variables:",
      expect.stringContaining(variable),
    );
  };

  it("stops the service on an invalid variable", () => {
    stubEnv({ ...SERVER_ENV, DATABASE_PORT: "not-a-port" });

    expectStop("DATABASE_PORT");
  });

  it.each(REQUIRED_IN_PRODUCTION)(
    "stops the service in production without %s",
    (name) => {
      stubEnv({ ...SERVER_ENV, [name]: " " });

      expectStop(`${name} is required in production`);
    },
  );

  it("starts outside production without the secrets", () => {
    stubEnv({
      NODE_ENV: "development",
      ...Object.fromEntries(
        REQUIRED_IN_PRODUCTION.map((name) => [name, undefined]),
      ),
    });

    expect(validateEnv()).toMatchObject({ NODE_ENV: "development" });
  });
});
