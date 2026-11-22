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

/** The room a connecting client joins, and until when it may stay there. */
interface RoomAccess {
  userId: string;
  /** Absent in observe mode, where the client gives its own userId. */
  expiresAt?: Date;
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
): Promise<RoomAccess | null> {
  const token = client.handshake.auth?.token;
  const access = await verifier.verifyAccess(
    typeof token === "string" ? token : null,
  );
  if (access) return access;
  if (mode === "enforce") return null;
  const userId = extractUserId(client);
  if (userId) {
    logger.warn(
      `Observe mode: socket ${client.id} connected without a valid access token`,
    );
  }
  return userId ? { userId } : null;
}

// setTimeout takes at most 2^31 - 1 ms (about 24 days)
const LONGEST_TIMER_MS = 2_147_483_647;

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

  /** The end of the access token of each open socket, by socket id. */
  private readonly expiries = new Map<string, NodeJS.Timeout>();

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
    const access = await resolveRoom(
      client,
      this.verifier,
      this.mode,
      this.logger,
    );
    if (!access) {
      this.logger.warn(
        `Rejected socket connection on ${this.label} without a valid user: ${client.id}`,
      );
      client.disconnect(true);
      return;
    }

    const { userId, expiresAt } = access;
    await client.join(userId);
    if (expiresAt) this.closeAtExpiry(client, expiresAt);
    this.logger.log(
      `[${this.label}] User connected: userId=${userId}, socketId=${client.id}`,
    );
  }

  /**
   * Closes the connection when its access token expires (ADM-N19): the
   * socket would otherwise stay in the room of its user for as long as it is
   * open, after the account is disabled too. The transport is closed rather
   * than the socket disconnected: socket.io clients then connect again by
   * themselves, with a new token, while a disconnect would leave them off.
   */
  private closeAtExpiry(client: Socket, expiresAt: Date): void {
    const delay = Math.min(
      Math.max(expiresAt.getTime() - Date.now(), 0),
      LONGEST_TIMER_MS,
    );
    const timer = setTimeout(() => {
      this.expiries.delete(client.id);
      this.logger.log(
        `[${this.label}] Access token expired: closing socketId=${client.id}`,
      );
      client.conn.close();
    }, delay);
    timer.unref();
    this.expiries.set(client.id, timer);
  }

  public handleDisconnect(client: Socket): void {
    clearTimeout(this.expiries.get(client.id));
    this.expiries.delete(client.id);
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
