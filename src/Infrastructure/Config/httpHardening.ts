import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { HTTP_CORS_OPTIONS } from "./allowedOrigins.js";

const JSON_BODY_LIMIT = "100kb";

/**
 * HTTP settings of the service, shared by main.ts and the tests:
 * - the client address is read from X-Forwarded-For only when the request
 *   comes from a private address (nginx on the Docker network);
 * - helmet security headers;
 * - JSON bodies above 100 kB answer 413;
 * - CORS limited to the listed origins.
 */
export function applyHttpHardening(app: NestExpressApplication): void {
  app.set("trust proxy", "loopback, linklocal, uniquelocal");
  app.use(helmet());
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  app.enableCors(HTTP_CORS_OPTIONS);
}
