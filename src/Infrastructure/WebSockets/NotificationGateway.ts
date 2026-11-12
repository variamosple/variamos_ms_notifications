import { Inject, Injectable, Logger } from "@nestjs/common";
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
import {
  ACCESS_CONTROL_MODE_TOKEN,
  type AccessControlMode,
} from "../Auth/AccessControlMode.js";
import { AccessTokenVerifier } from "../Auth/AccessTokenVerifier.js";
import { ALLOWED_ORIGINS } from "../Config/allowedOrigins.js";

function extractUserId(client: Socket): string | null {
  let raw = client.handshake.auth?.userId || client.handshake.query?.userId;
  if (Array.isArray(raw)) {
    raw = raw[0];
  }
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

/**
 * Room to join for a connecting client: the user of a valid access token
 * (`handshake.auth.token`). Without one, "observe" mode keeps the userId the
 * client gives, and "enforce" mode refuses the connection (null).
 */
async function resolveRoom(
  client: Socket,
  verifier: AccessTokenVerifier,
  mode: AccessControlMode,
  logger: Logger,
): Promise<string | null> {
  const token = client.handshake.auth?.token;
  const principal = await verifier.verify(
    typeof token === "string" ? token : null,
  );
  if (principal) return principal.userId;
  if (mode === "enforce") return null;
  const userId = extractUserId(client);
  if (userId) {
    logger.warn(
      `Observe mode: socket ${client.id} connected without a valid access token`,
    );
  }
  return userId;
}

/**
 * The connection logic of both namespaces (EV-99, CA-NT-10): a client joins
 * the room of its user, or is disconnected. Both namespaces stay, `/` and
 * `/variamos_ms_notifications`: the clients of the platform connect to one
 * or the other, and removing one would cut them off.
 */
abstract class UserRoomGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  protected abstract readonly label: string;
  protected abstract readonly logger: Logger;

  @WebSocketServer()
  private readonly server!: Server;

  protected constructor(
    private readonly verifier: AccessTokenVerifier,
    private readonly mode: AccessControlMode,
  ) {}

  public afterInit(_server: Server): void {
    this.logger.log(
      `${this.constructor.name} (namespace: ${this.label}) initialized`,
    );
  }

  // To the room of the recipient, on this namespace only
  public emit(notification: Notification, payload: unknown): void {
    this.server?.to(notification.recipientId).emit("notification", payload);
  }

  public async handleConnection(client: Socket): Promise<void> {
    const userId = await resolveRoom(
      client,
      this.verifier,
      this.mode,
      this.logger,
    );
    if (!userId) {
      this.logger.warn(
        `Rejected socket connection on ${this.label} without a valid user: ${client.id}`,
      );
      client.disconnect(true);
      return;
    }

    await client.join(userId);
    this.logger.log(
      `[${this.label}] User connected: userId=${userId}, socketId=${client.id}`,
    );
  }

  public handleDisconnect(client: Socket): void {
    const userId = extractUserId(client);
    if (userId) {
      this.logger.log(
        `[${this.label}] User disconnected: userId=${userId}, socketId=${client.id}`,
      );
    }
  }
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: ALLOWED_ORIGINS,
  },
})
export class RootNotificationGateway extends UserRoomGateway {
  protected readonly label = "/";
  protected readonly logger = new Logger(RootNotificationGateway.name);

  constructor(
    verifier: AccessTokenVerifier,
    @Inject(ACCESS_CONTROL_MODE_TOKEN)
    mode: AccessControlMode,
  ) {
    super(verifier, mode);
  }
}

/**
 * The channel of the notifications: each one goes once to each namespace,
 * so a client connected to one of them receives it once.
 */
@Injectable()
@WebSocketGateway({
  namespace: "variamos_ms_notifications",
  cors: {
    origin: ALLOWED_ORIGINS,
  },
})
export class NotificationGateway
  extends UserRoomGateway
  implements INotificationChannel
{
  protected readonly label = "/variamos_ms_notifications";
  protected readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly rootGateway: RootNotificationGateway,
    verifier: AccessTokenVerifier,
    @Inject(ACCESS_CONTROL_MODE_TOKEN)
    mode: AccessControlMode,
  ) {
    super(verifier, mode);
  }

  public send(notification: Notification): Promise<void> {
    const payload = {
      id: notification.id,
      templateKey: notification.templateKey,
      variables: notification.variables,
      metadata: notification.metadata,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };

    this.emit(notification, payload);
    this.rootGateway.emit(notification, payload);
    return Promise.resolve();
  }
}
