import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTERNAL_TOKEN_MIN_LENGTH,
  REQUIRED_IN_PRODUCTION,
  readEnv,
  validateEnv,
} from "./env.config.js";

// Every variable the service reads, as the server sets them
const SERVER_ENV = {
  NODE_ENV: "production",
  PORT: "3001",
  NOTIFICATION_INTERNAL_TOKEN: "test-internal-token-of-32-characters",
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

  // Runs validateEnv, checks it stopped the service, returns what it logged
  const stopMessage = (): string => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => validateEnv()).toThrow("exit");
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(
      "Invalid environment variables:",
      expect.any(String),
    );
    return String(error.mock.calls[0]?.[1]);
  };

  it("stops the service on an invalid variable", () => {
    stubEnv({ ...SERVER_ENV, DATABASE_PORT: "not-a-port" });

    expect(stopMessage()).toContain("DATABASE_PORT");
  });

  // A port that is not one: refused by name and rule, never shown (EV-45)
  describe.each(["PORT", "DATABASE_PORT"])("%s", (name) => {
    it.each(["0", "-1", "3005.5", "65536", "not-a-port"])(
      "stops the service on %s",
      (value) => {
        stubEnv({ ...SERVER_ENV, [name]: value });

        const message = stopMessage();
        expect(message).toContain(name);
        expect(message).toContain("must be a whole number from 1 to 65535");
      },
    );

    it.each(["3005.5", "65536", "not-a-port"])("never shows %s", (value) => {
      stubEnv({ ...SERVER_ENV, [name]: value });

      expect(stopMessage()).not.toContain(value);
    });

    it.each(["", "  "])("takes the default on %j", (value) => {
      stubEnv({ ...SERVER_ENV, [name]: value });

      expect(validateEnv()[name as "PORT" | "DATABASE_PORT"]).toBe(
        name === "PORT" ? 3000 : 5432,
      );
    });

    it.each([
      ["1", 1],
      ["65535", 65535],
    ])("accepts %s", (value, expected) => {
      stubEnv({ ...SERVER_ENV, [name]: value });

      expect(validateEnv()[name as "PORT" | "DATABASE_PORT"]).toBe(expected);
    });
  });

  it.each([
    [undefined, "variamos"],
    ["", "variamos"],
    ["other", "other"],
  ])("reads DATABASE_SCHEMA=%j as %s", (value, expected) => {
    stubEnv({ ...SERVER_ENV, DATABASE_SCHEMA: value });

    expect(validateEnv().DATABASE_SCHEMA).toBe(expected);
  });

  describe("short internal token", () => {
    const shortToken = "a".repeat(INTERNAL_TOKEN_MIN_LENGTH - 1);
    const warnings = () =>
      vi.spyOn(console, "warn").mockImplementation(() => {});

    // Refused once the module secrets are renewed (ADR-0079)
    it("only warns in production, without the token or its length", () => {
      const warn = warnings();
      stubEnv({ ...SERVER_ENV, NOTIFICATION_INTERNAL_TOKEN: shortToken });

      expect(validateEnv().NOTIFICATION_INTERNAL_TOKEN).toBe(shortToken);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        "NOTIFICATION_INTERNAL_TOKEN is shorter than 32 characters: it will be refused once renewed",
      );
      expect(String(warn.mock.calls[0]?.[0])).not.toContain(shortToken);
      expect(String(warn.mock.calls[0]?.[0])).not.toContain("31");
    });

    it("does not warn outside production", () => {
      const warn = warnings();
      stubEnv({
        ...SERVER_ENV,
        NODE_ENV: "development",
        NOTIFICATION_INTERNAL_TOKEN: shortToken,
      });

      validateEnv();
      expect(warn).not.toHaveBeenCalled();
    });

    it(`does not warn from ${INTERNAL_TOKEN_MIN_LENGTH.toString()} characters`, () => {
      const warn = warnings();
      stubEnv({
        ...SERVER_ENV,
        NOTIFICATION_INTERNAL_TOKEN: "a".repeat(INTERNAL_TOKEN_MIN_LENGTH),
      });

      validateEnv();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it.each(REQUIRED_IN_PRODUCTION)(
    "stops the service in production without %s",
    (name) => {
      stubEnv({ ...SERVER_ENV, [name]: " " });

      expect(stopMessage()).toContain(`${name} is required in production`);
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

  describe("readEnv", () => {
    it("reads the configuration validateEnv checked", () => {
      expect(readEnv(SERVER_ENV)).toEqual({
        ...SERVER_ENV,
        PORT: 3001,
        DATABASE_PORT: 5433,
        DATABASE_SSL: true,
      });
    });

    it("throws on an invalid configuration, without stopping", () => {
      expect(() => readEnv({ ...SERVER_ENV, PORT: "0" })).toThrow(
        "must be a whole number from 1 to 65535",
      );
    });
  });
});
