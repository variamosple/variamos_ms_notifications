import { describe, expect, it, vi } from "vitest";
import { prepareDatabase } from "./prepareDatabase.js";

const fakeDatabase = (environment: string | null) => ({
  query: vi.fn(() => Promise.resolve([{ value: environment }])),
  runMigrations: vi.fn(() => Promise.resolve([{ name: "m1" }, { name: "m2" }])),
});

const logger = () => ({ log: vi.fn(), warn: vi.fn() });

describe("prepareDatabase", () => {
  it("applies the migrations on a local database", async () => {
    const database = fakeDatabase(null);
    const log = logger();

    await prepareDatabase(
      database as never,
      { NODE_ENV: "development", DATABASE_HOST: "localhost" },
      log,
    );

    expect(database.query).toHaveBeenCalledWith(
      "SELECT current_setting($1, true) AS value",
      ["variamos.environment"],
    );
    expect(database.runMigrations).toHaveBeenCalledOnce();
    expect(log.log).toHaveBeenCalledWith("2 migration(s) applied");
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("does not migrate the production database reached through a tunnel", async () => {
    const database = fakeDatabase("production");
    const log = logger();

    const decision = await prepareDatabase(
      database as never,
      { NODE_ENV: "development", DATABASE_HOST: "localhost" },
      log,
    );

    expect(decision.allowed).toBe(false);
    expect(database.runMigrations).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "the database says it is the production database",
      ),
    );
  });

  it("does not migrate a database on another machine", async () => {
    const database = fakeDatabase(null);

    await prepareDatabase(
      database as never,
      { NODE_ENV: "development", DATABASE_HOST: "db.example.org" },
      logger(),
    );

    expect(database.runMigrations).not.toHaveBeenCalled();
  });

  it("migrates in production, whatever the database says", async () => {
    const database = fakeDatabase("production");

    await prepareDatabase(
      database as never,
      { NODE_ENV: "production", DATABASE_HOST: "database" },
      logger(),
    );

    expect(database.runMigrations).toHaveBeenCalledOnce();
  });

  it("migrates a remote database when the variable allows it, with a warning", async () => {
    const database = fakeDatabase("production");
    const log = logger();

    await prepareDatabase(
      database as never,
      {
        NODE_ENV: "development",
        DATABASE_HOST: "localhost",
        ALLOW_AUTOMATIC_WRITES_ON_REMOTE_DATABASE: "true",
      },
      log,
    );

    expect(database.runMigrations).toHaveBeenCalledOnce();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("ALLOW_AUTOMATIC_WRITES_ON_REMOTE_DATABASE"),
    );
  });
});
