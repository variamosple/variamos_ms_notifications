import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Notification } from "../../Domain/Entities/Notification.js";
import { INotificationChannel } from "../../Domain/Services/INotificationChannel.js";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class NotificationGateway
  implements INotificationChannel, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  // Map userId to a Set of socket IDs to support multiple active tabs per user
  private readonly activeConnections = new Map<string, Set<string>>();

  public async send(notification: Notification): Promise<void> {
    const payload = {
      id: notification.id,
      templateKey: notification.templateKey,
      variables: notification.variables,
      metadata: notification.metadata,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };

    // Emit to room userId (and directly to tracked sockets)
    this.server.to(notification.recipientId).emit("notification", payload);

    const socketIds = this.activeConnections.get(notification.recipientId);
    if (socketIds && socketIds.size > 0) {
      for (const socketId of socketIds) {
        this.server.to(socketId).emit("notification", payload);
      }
    }
  }

  public handleConnection(client: Socket): void {
    const userId = this.extractUserId(client);
    if (!userId) {
      client.disconnect(true);
      return;
    }

    client.join(userId);

    let userSockets = this.activeConnections.get(userId);
    if (!userSockets) {
      userSockets = new Set<string>();
      this.activeConnections.set(userId, userSockets);
    }
    userSockets.add(client.id);
  }

  public handleDisconnect(client: Socket): void {
    const userId = this.extractUserId(client);
    if (!userId) {
      return;
    }

    const userSockets = this.activeConnections.get(userId);
    if (userSockets) {
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.activeConnections.delete(userId);
      }
    }
  }

  private extractUserId(client: Socket): string | null {
    // Support retrieving userId from handshake auth object or query params
    const userId =
      client.handshake.auth?.userId || client.handshake.query?.userId;
    return typeof userId === "string" && userId.trim() !== "" ? userId : null;
  }
}
