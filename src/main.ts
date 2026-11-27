import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DataSource } from "typeorm";
import { AppModule } from "./app.module.js";
import { configureApplication } from "./Infrastructure/Config/configureApplication.js";
import { validateEnv } from "./Infrastructure/Config/env.config.js";
import { prepareDatabase } from "./Infrastructure/Persistence/TypeORM/prepareDatabase.js";

async function bootstrap(): Promise<void> {
  const config = validateEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // No request is served on a schema that failed to migrate
  await prepareDatabase(
    app.get(DataSource),
    process.env,
    new Logger("Database"),
  );
  configureApplication(app);
  await app.listen(config.PORT, "0.0.0.0");
}

// A service that cannot start stops, with the reason in its log
bootstrap().catch((error: unknown) => {
  Logger.error(
    "The notification service could not start",
    error instanceof Error ? error.stack : String(error),
    "Bootstrap",
  );
  process.exit(1);
});
