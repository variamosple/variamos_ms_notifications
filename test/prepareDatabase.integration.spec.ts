import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATIONS_MIGRATIONS,
  NOTIFICATIONS_MIGRATIONS_TABLE,
} from "../src/Infrastructure/Persistence/TypeORM/Migrations/index.js";
import {
  prepareDatabase,
  readDatabaseEnvironment,
} from "../src/Infrastructure/Persistence/TypeORM/prepareDatabase.js";

// ADM-N32: the production database says what it is, to every connection,
// and a workstation does not migrate it
describe("prepareDatabase on PostgreSQL", () => {
  let container: StartedPostgreSqlContainer;

  const connect = async () => {
    const dataSource = new DataSource({
      type: "postgres",
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      schema: "public",
      migrations: NOTIFICATIONS_MIGRATIONS,
      migrationsTableName: NOTIFICATIONS_MIGRATIONS_TABLE,
    });
    return dataSource.initialize();
  };

  const migrationCount = async () => {
    const dataSource = await connect();
    try {
      const [row] = await dataSource.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = $1",
        [NOTIFICATIONS_MIGRATIONS_TABLE],
      );
      return row.n as number;
    } finally {
      await dataSource.destroy();
    }
  };

  const logger = () => ({ log: vi.fn(), warn: vi.fn() });
  const workstation = { NODE_ENV: "development", DATABASE_HOST: "localhost" };

  beforeAll(async () => {
    // Production runs PostgreSQL 14
    container = await new PostgreSqlContainer("postgres:14-alpine").start();
    const dataSource = await connect();
    await dataSource.query(
      `ALTER DATABASE "${container.getDatabase()}" SET variamos.environment = 'production'`,
    );
    await dataSource.destroy();
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it("reads the setting of the database on a new connection", async () => {
    const dataSource = await connect();
    try {
      await expect(readDatabaseEnvironment(dataSource)).resolves.toBe(
        "production",
      );
    } finally {
      await dataSource.destroy();
    }
  });

  it("leaves the marked database untouched on a workstation", async () => {
    const dataSource = await connect();
    try {
      const decision = await prepareDatabase(dataSource, workstation, logger());
      expect(decision.allowed).toBe(false);
    } finally {
      await dataSource.destroy();
    }
    await expect(migrationCount()).resolves.toBe(0);
  });

  it("migrates it when the variable allows it", async () => {
    const dataSource = await connect();
    try {
      await prepareDatabase(
        dataSource,
        { ...workstation, ALLOW_AUTOMATIC_WRITES_ON_REMOTE_DATABASE: "true" },
        logger(),
      );
    } finally {
      await dataSource.destroy();
    }
    await expect(migrationCount()).resolves.toBe(1);
  });
});
