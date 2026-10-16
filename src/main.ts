import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module.js";
import { HTTP_CORS_OPTIONS } from "./Infrastructure/Config/allowedOrigins.js";
import { validateEnv } from "./Infrastructure/Config/env.config.js";

async function bootstrap(): Promise<void> {
  validateEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors(HTTP_CORS_OPTIONS);
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}
bootstrap();
