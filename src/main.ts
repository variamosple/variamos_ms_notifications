import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { configureApplication } from "./Infrastructure/Config/configureApplication.js";
import { validateEnv } from "./Infrastructure/Config/env.config.js";

async function bootstrap(): Promise<void> {
  validateEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApplication(app);
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}

// A service that cannot start stops, with the reason in its log
bootstrap().catch((error: unknown) => {
  console.error("The notification service could not start", error);
  process.exit(1);
});
