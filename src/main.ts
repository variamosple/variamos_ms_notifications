import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { validateEnv } from "./Infrastructure/Config/env.config.js";

async function bootstrap(): Promise<void> {
  validateEnv();
  const app = await NestFactory.create(AppModule);
  if (process.env.NODE_ENV !== "production") {
    app.enableCors();
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
