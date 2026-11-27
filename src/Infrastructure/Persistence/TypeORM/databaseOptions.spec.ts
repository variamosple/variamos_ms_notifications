import { describe, expect, it } from "vitest";
import { type EnvConfig, readEnv } from "../../Config/env.config.js";
import { databaseOptions } from "./databaseOptions.js";

const config = (env: Record<string, string>): EnvConfig => readEnv(env);

describe("databaseOptions", () => {
  it("connects with the validated configuration only", () => {
    expect(
      databaseOptions(
        config({
          DATABASE_HOST: "db",
          DATABASE_PORT: "5433",
          DATABASE_USERNAME: "notifications",
          DATABASE_PASSWORD: "test-password",
          DATABASE_NAME: "notifications",
          DATABASE_SCHEMA: "variamos",
        }),
      ),
    ).toMatchObject({
      type: "postgres",
      host: "db",
      port: 5433,
      username: "notifications",
      password: "test-password",
      database: "notifications",
      schema: "variamos",
      synchronize: false,
      migrationsRun: false,
      ssl: false,
    });
  });

  // No test credentials and no host written in the code (SEC-TR-15)
  it("adds no value of its own outside the defaults of the configuration", () => {
    const options = databaseOptions(config({}));

    expect(options).toMatchObject({ port: 5432, schema: "variamos" });
    for (const key of ["host", "username", "password", "database"] as const) {
      expect(options[key]).toBeUndefined();
    }
  });

  // true: node-postgres checks the certificate, never rejectUnauthorized: false
  it("checks the server certificate with TLS", () => {
    expect(databaseOptions(config({ DATABASE_SSL: "true" })).ssl).toBe(true);
  });
});
