import type { DataSource } from "typeorm";
import {
  ALLOW_REMOTE_WRITES_VARIABLE,
  type AutomaticWrites,
  DATABASE_ENVIRONMENT_SETTING,
  decideAutomaticWrites,
} from "../../Config/automaticWrites.js";

interface StartLogger {
  log(message: string): void;
  warn(message: string): void;
}

/** The environment the database says it is (variamos.environment), or null */
export async function readDatabaseEnvironment(
  dataSource: Pick<DataSource, "query">,
): Promise<string | null> {
  const rows: { value: string | null }[] = await dataSource.query(
    "SELECT current_setting($1, true) AS value",
    [DATABASE_ENVIRONMENT_SETTING],
  );
  return rows[0]?.value || null;
}

/**
 * Applies the migrations at start, unless the database must not be written
 * without being asked (ADM-N32): outside production, a remote database or
 * the production one reached through a tunnel.
 */
export async function prepareDatabase(
  dataSource: Pick<DataSource, "query" | "runMigrations">,
  env: NodeJS.ProcessEnv,
  logger: StartLogger,
): Promise<AutomaticWrites> {
  const decision = decideAutomaticWrites({
    nodeEnv: env.NODE_ENV ?? "",
    host: env.DATABASE_HOST || "localhost",
    databaseEnvironment: await readDatabaseEnvironment(dataSource),
    allowRemote: env[ALLOW_REMOTE_WRITES_VARIABLE],
  });
  if (!decision.allowed) {
    logger.warn(
      `${decision.reason}: no migration. Set ${ALLOW_REMOTE_WRITES_VARIABLE}=true to allow them.`,
    );
    return decision;
  }
  if (decision.warning) logger.warn(decision.warning);
  const applied = await dataSource.runMigrations();
  logger.log(`${applied.length} migration(s) applied`);
  return decision;
}
