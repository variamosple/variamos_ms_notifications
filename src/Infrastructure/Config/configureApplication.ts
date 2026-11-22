import type { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { applyHttpHardening } from "./httpHardening.js";

/**
 * Everything main.ts sets on the application before it listens: HTTP
 * hardening, the socket.io adapter and the shutdown on a signal. The e2e
 * tests build their application with it too, so that they test the service
 * as it runs.
 */
export function configureApplication(app: NestExpressApplication): void {
  applyHttpHardening(app);
  app.useWebSocketAdapter(new IoAdapter(app));
  // docker stop sends SIGTERM to node, process 1, which ignored it: Docker
  // killed the service after 10 s, its sockets and database left open
  // (ADM-N21). Nest now closes the server, socket.io and TypeORM, then exits
  app.enableShutdownHooks(["SIGTERM", "SIGINT"]);
}
