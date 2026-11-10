import type { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { applyHttpHardening } from "./httpHardening.js";

/**
 * Everything main.ts sets on the application before it listens: HTTP
 * hardening and the socket.io adapter. The e2e tests build their
 * application with it too, so that they test the service as it runs.
 */
export function configureApplication(app: NestExpressApplication): void {
  applyHttpHardening(app);
  app.useWebSocketAdapter(new IoAdapter(app));
}
