import { readFileSync } from "node:fs";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { DataSource, DataSourceOptions } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotificationEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationEntity.js";
import { NotificationTemplateEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationTemplateEntity.js";
import { UserPreferencesEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/UserPreferencesEntity.js";
import { INBOX_INDEX } from "../src/Infrastructure/Persistence/TypeORM/Migrations/1793577600000-InboxIndex.js";
import { EVENT_RECIPIENT_INDEX } from "../src/Infrastructure/Persistence/TypeORM/Migrations/1794268800000-NotificationEventId.js";
import { PLATFORM_TEMPLATES } from "../src/Infrastructure/Persistence/TypeORM/Migrations/1794268800001-NotificationTemplates.js";
import {
  NOTIFICATIONS_MIGRATIONS,
  NOTIFICATIONS_MIGRATIONS_TABLE,
} from "../src/Infrastructure/Persistence/TypeORM/Migrations/index.js";

const ENTITIES = [
  NotificationEntity,
  NotificationTemplateEntity,
  UserPreferencesEntity,
];

const productionSchema = (schema: string) =>
  readFileSync(
    new URL("./fixtures/production-schema-2026-10-18.sql", import.meta.url),
    "utf8",
  ).replaceAll("variamos.", `"${schema}".`);

describe("Schema migrations (Integration)", () => {
  let container: StartedPostgreSqlContainer;
  const open: DataSource[] = [];

  const connect = async (
    schema: string,
    extra: Partial<DataSourceOptions> = {},
  ) => {
    const dataSource = new DataSource({
      type: "postgres",
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      schema,
      entities: ENTITIES,
      migrations: NOTIFICATIONS_MIGRATIONS,
      migrationsTableName: NOTIFICATIONS_MIGRATIONS_TABLE,
      ...extra,
    } as DataSourceOptions);
    await dataSource.initialize();
    open.push(dataSource);
    return dataSource;
  };

  // What synchronize would still change: nothing when migrations match the entities
  const pendingSchemaChanges = async (dataSource: DataSource) =>
    (await dataSource.driver.createSchemaBuilder().log()).upQueries.map(
      (q) => q.query,
    );

  const tablesOf = async (dataSource: DataSource, schema: string) =>
    (
      await dataSource.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1",
        [schema],
      )
    ).map((row: { table_name: string }) => row.table_name);

  // Columns, constraints and indexes, with the schema name left out
  const structureOf = async (dataSource: DataSource, schema: string) => ({
    columns: await dataSource.query(
      `SELECT table_name, column_name, data_type, udt_name, character_maximum_length,
              is_nullable, column_default
         FROM information_schema.columns WHERE table_schema = $1 AND table_name <> $2
        ORDER BY table_name, column_name`,
      [schema, NOTIFICATIONS_MIGRATIONS_TABLE],
    ),
    constraints: await dataSource
      .query(
        `SELECT conrelid::regclass::text AS on_table, conname, pg_get_constraintdef(oid) AS def
           FROM pg_constraint WHERE connamespace = $1::regnamespace
            AND conrelid <> coalesce(to_regclass(format('%I.%I', $1::text, $2::text)), 0)
          ORDER BY conname`,
        [schema, NOTIFICATIONS_MIGRATIONS_TABLE],
      )
      .then((rows: { on_table: string }[]) =>
        rows.map((row) => ({
          ...row,
          on_table: row.on_table.replace(/^.*\./, ""),
        })),
      ),
    indexes: await dataSource.query(
      `SELECT indexname, replace(indexdef, $1 || '.', '') AS def
         FROM pg_indexes WHERE schemaname = $2 AND tablename <> $3 ORDER BY indexname`,
      [schema, schema, NOTIFICATIONS_MIGRATIONS_TABLE],
    ),
  });

  beforeAll(async () => {
    // Production runs PostgreSQL 14
    container = await new PostgreSqlContainer("postgres:14-alpine").start();
    const admin = await connect("public");
    await admin.query(
      'CREATE SCHEMA "fresh"; CREATE SCHEMA "legacy"; CREATE SCHEMA "rerun"',
    );
  }, 60000);

  afterAll(async () => {
    for (const dataSource of open) {
      if (dataSource.isInitialized) await dataSource.destroy();
    }
    await container?.stop();
  });

  it("creates the tables of an empty schema exactly as the entities describe them", async () => {
    const dataSource = await connect("fresh");

    const applied = await dataSource.runMigrations();

    expect(applied.map((m) => m.name)).toEqual([
      "Baseline1792281600000",
      "InboxIndex1793577600000",
      "NotificationEventId1794268800000",
      "NotificationTemplates1794268800001",
    ]);
    expect(await pendingSchemaChanges(dataSource)).toEqual([]);
    expect(await tablesOf(dataSource, "fresh")).toEqual([
      "notification_templates",
      "notifications",
      "notifications_migrations",
      "user_preferences",
    ]);
    // A new database accepts the sends of the platform (EV-99)
    expect(
      await dataSource.query(
        'SELECT "key" FROM "fresh"."notification_templates" ORDER BY 1',
      ),
    ).toEqual(
      PLATFORM_TEMPLATES.map((t) => ({ key: t.key })).sort((a, b) =>
        a.key.localeCompare(b.key),
      ),
    );
  });

  it("leaves the production tables and their rows untouched", async () => {
    // Production before T-07: tables created by hand, no migrations table
    const before = await connect("legacy", { migrations: [] });
    await before.query(productionSchema("legacy"));
    await before.query(
      `INSERT INTO "legacy"."notifications" ("id", "recipient_id", "template_key", "variables")
       VALUES ('7d0f3e1c-3f43-4f7e-9d54-4b8f0a6a7d11', 'user-1', 'welcome', '{"name":"Ada"}')`,
    );
    await before.query(
      `INSERT INTO "legacy"."user_preferences" ("user_id", "muted_event_types") VALUES ('user-1', '{bug}')`,
    );
    // A template made by hand in production, with its own texts
    await before.query(
      `INSERT INTO "legacy"."notification_templates" ("key", "title_template", "body_template") VALUES ('admin_alert', 'Alert: {{title}}', '{{body}}')`,
    );
    const structureBefore = await structureOf(before, "legacy");
    await before.destroy();

    const dataSource = await connect("legacy");
    expect(await dataSource.runMigrations()).toHaveLength(4);

    // The same tables and rows; only the inbox index, the send key column
    // and its index are new
    const added = [INBOX_INDEX, EVENT_RECIPIENT_INDEX];
    const structureAfter = await structureOf(dataSource, "legacy");
    expect(
      structureAfter.indexes.map((i: { indexname: string }) => i.indexname),
    ).toEqual(expect.arrayContaining(added));
    expect(
      structureAfter.columns.filter(
        (c: { column_name: string }) => c.column_name === "event_id",
      ),
    ).toEqual([
      expect.objectContaining({
        table_name: "notifications",
        character_maximum_length: 128,
        is_nullable: "YES",
        column_default: null,
      }),
    ]);
    expect({
      ...structureAfter,
      columns: structureAfter.columns.filter(
        (c: { column_name: string }) => c.column_name !== "event_id",
      ),
      indexes: structureAfter.indexes.filter(
        (i: { indexname: string }) => !added.includes(i.indexname),
      ),
    }).toEqual(structureBefore);
    expect(await pendingSchemaChanges(dataSource)).toEqual([]);
    expect(
      await dataSource.query(
        'SELECT "recipient_id", "variables" FROM "legacy"."notifications"',
      ),
    ).toEqual([{ recipient_id: "user-1", variables: { name: "Ada" } }]);
    expect(
      await dataSource.query(
        'SELECT "muted_event_types" FROM "legacy"."user_preferences"',
      ),
    ).toEqual([{ muted_event_types: ["bug"] }]);
    // The template made by hand is kept; the missing ones are added
    expect(
      await dataSource.query(
        `SELECT "title_template" FROM "legacy"."notification_templates" WHERE "key" = 'admin_alert'`,
      ),
    ).toEqual([{ title_template: "Alert: {{title}}" }]);
    expect(
      await dataSource.query(
        'SELECT count(*)::int AS n FROM "legacy"."notification_templates"',
      ),
    ).toEqual([{ n: PLATFORM_TEMPLATES.length }]);
  });

  it("gives a new database the same structure as production", async () => {
    const fresh = await connect("fresh");
    const legacy = await connect("legacy");

    expect(await structureOf(fresh, "fresh")).toEqual(
      await structureOf(legacy, "legacy"),
    );
  });

  it("applies each migration once", async () => {
    const first = await connect("rerun");
    await first.runMigrations();
    await first.destroy();

    const second = await connect("rerun", { migrationsRun: true });

    expect(await second.runMigrations()).toEqual([]);
    expect(
      await second.query(
        `SELECT count(*)::int AS n FROM "rerun"."${NOTIFICATIONS_MIGRATIONS_TABLE}"`,
      ),
    ).toEqual([{ n: NOTIFICATIONS_MIGRATIONS.length }]);
  });

  it("reverts each migration in turn, then refuses to revert the baseline", async () => {
    const dataSource = await connect("fresh");
    const indexes = (name: string) =>
      dataSource.query(
        `SELECT indexname FROM pg_indexes WHERE schemaname = 'fresh' AND indexname = $1`,
        [name],
      );
    const templateCount = async () =>
      (
        await dataSource.query(
          'SELECT count(*)::int AS n FROM "fresh"."notification_templates"',
        )
      )[0].n;
    const eventIdColumns = () =>
      dataSource.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'fresh' AND table_name = 'notifications' AND column_name = 'event_id'`,
      );
    expect(await indexes(INBOX_INDEX)).toHaveLength(1);
    expect(await indexes(EVENT_RECIPIENT_INDEX)).toHaveLength(1);

    // The templates stay: they may have been there before
    await dataSource.undoLastMigration();
    expect(await templateCount()).toBe(PLATFORM_TEMPLATES.length);

    await dataSource.undoLastMigration();
    expect(await indexes(EVENT_RECIPIENT_INDEX)).toEqual([]);
    expect(await eventIdColumns()).toEqual([]);

    await dataSource.undoLastMigration();
    expect(await indexes(INBOX_INDEX)).toEqual([]);

    await expect(dataSource.undoLastMigration()).rejects.toThrow(
      "The baseline migration cannot be reverted.",
    );
    expect(await tablesOf(dataSource, "fresh")).toContain("notifications");
  });
});
