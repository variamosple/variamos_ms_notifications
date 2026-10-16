import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module.js";
import { validateEnv } from "./Infrastructure/Config/env.config.js";
import { applyHttpHardening } from "./Infrastructure/Config/httpHardening.js";

async function bootstrap(): Promise<void> {
  validateEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  applyHttpHardening(app);
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}
bootstrap();
