import type { DataSourceOptions } from "typeorm";
import type { EnvConfig } from "../../Config/env.config.js";
import { NotificationEntity } from "./Entities/NotificationEntity.js";
import { NotificationTemplateEntity } from "./Entities/NotificationTemplateEntity.js";
import { UserPreferencesEntity } from "./Entities/UserPreferencesEntity.js";
import {
  NOTIFICATIONS_MIGRATIONS,
  NOTIFICATIONS_MIGRATIONS_TABLE,
} from "./Migrations/index.js";

/**
 * The connection, from the validated configuration only: no value written
 * here, no other variable read (SEC-TR-15, EV-45).
 */
type PostgresOptions = Extract<DataSourceOptions, { type: "postgres" }>;

export function databaseOptions(config: EnvConfig): PostgresOptions {
  return {
    type: "postgres",
    host: config.DATABASE_HOST,
    port: config.DATABASE_PORT,
    username: config.DATABASE_USERNAME,
    password: config.DATABASE_PASSWORD,
    database: config.DATABASE_NAME,
    schema: config.DATABASE_SCHEMA,
    entities: [
      NotificationEntity,
      NotificationTemplateEntity,
      UserPreferencesEntity,
    ],
    // The schema changes only through versioned migrations (T-07):
    // synchronize would drop the columns and indexes it does not know
    synchronize: false,
    migrations: NOTIFICATIONS_MIGRATIONS,
    migrationsTableName: NOTIFICATIONS_MIGRATIONS_TABLE,
    // Applied by prepareDatabase at start, which first checks that
    // this database may be written without being asked (ADM-N32)
    migrationsRun: false,
    // With TLS, the server certificate is checked against the authorities
    // Node trusts: a certificate it cannot check is refused (SEC-TR-15).
    // The production database does not use TLS (ssl = off).
    ssl: config.DATABASE_SSL,
  };
}
