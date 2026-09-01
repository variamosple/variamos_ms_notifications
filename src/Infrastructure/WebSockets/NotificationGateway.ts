import { Injectable, Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Notification } from "../../Domain/Entities/Notification.js";
import { INotificationChannel } from "../../Domain/Services/INotificationChannel.js";

function extractUserId(client: Socket): string | null {
  let raw = client.handshake.auth?.userId || client.handshake.query?.userId;
  if (Array.isArray(raw)) {
    raw = raw[0];
  }
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class RootNotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RootNotificationGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  public afterInit(_server: Server): void {
    this.logger.log("RootNotificationGateway (namespace: /) initialized");
  }

  public send(notification: Notification, payload: unknown): void {
    if (this.server) {
      this.server.to(notification.recipientId).emit("notification", payload);
    }
  }

  public handleConnection(client: Socket): void {
    const userId = extractUserId(client);
    if (!userId) {
      this.logger.warn(
        `Rejected root socket connection without userId: ${client.id}`,
      );
      client.disconnect(true);
      return;
    }

    client.join(userId);
    this.logger.log(
      `[Root /] User connected: userId=${userId}, socketId=${client.id}`,
    );
  }

  public handleDisconnect(client: Socket): void {
    const userId = extractUserId(client);
    if (userId) {
      this.logger.log(
        `[Root /] User disconnected: userId=${userId}, socketId=${client.id}`,
      );
    }
  }
}

@Injectable()
@WebSocketGateway({
  namespace: "variamos_ms_notifications",
  cors: {
    origin: "*",
  },
})
export class NotificationGateway
  implements
    INotificationChannel,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly rootGateway: RootNotificationGateway) {}

  public afterInit(_server: Server): void {
    this.logger.log(
      "NotificationGateway (namespace: /variamos_ms_notifications) initialized",
    );
  }

  public async send(notification: Notification): Promise<void> {
    const payload = {
      id: notification.id,
      templateKey: notification.templateKey,
      variables: notification.variables,
      metadata: notification.metadata,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };

    if (this.server) {
      this.server.to(notification.recipientId).emit("notification", payload);
    }

    this.rootGateway.send(notification, payload);
  }

  public handleConnection(client: Socket): void {
    const userId = extractUserId(client);
    if (!userId) {
      this.logger.warn(
        `Rejected namespace socket connection without userId: ${client.id}`,
      );
      client.disconnect(true);
      return;
    }

    client.join(userId);
    this.logger.log(
      `[Namespace /variamos_ms_notifications] User connected: userId=${userId}, socketId=${client.id}`,
    );
  }

  public handleDisconnect(client: Socket): void {
    const userId = extractUserId(client);
    if (userId) {
      this.logger.log(
        `[Namespace /variamos_ms_notifications] User disconnected: userId=${userId}, socketId=${client.id}`,
      );
    }
  }
}
