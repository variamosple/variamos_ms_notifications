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
import {
  AccessTokenVerifier,
  type VerifiedAccess,
} from "../Auth/AccessTokenVerifier.js";
import { ALLOWED_ORIGINS } from "../Config/allowedOrigins.js";

/**
 * The room of a connecting client: the user of its access token
 * (`handshake.auth.token`), or null without a valid one. A `userId` that
 * the client gives, in `auth` or in the query, is never read (TRV-66).
 */
function resolveRoom(
  client: Socket,
  verifier: AccessTokenVerifier,
): Promise<VerifiedAccess | null> {
  const token = client.handshake.auth?.token;
  return verifier.verifyAccess(typeof token === "string" ? token : null);
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

  /** The verified user of each open socket, for the disconnection log. */
  private readonly users = new Map<string, string>();

  protected constructor(private readonly verifier: AccessTokenVerifier) {}

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
    const access = await resolveRoom(client, this.verifier);
    if (!access) {
      this.logger.warn(
        `Rejected socket connection on ${this.label} without a valid user: ${client.id}`,
      );
      client.disconnect(true);
      return;
    }

    const { userId, expiresAt } = access;
    this.users.set(client.id, userId);
    await client.join(userId);
    this.closeAtExpiry(client, expiresAt);
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
    const userId = this.users.get(client.id);
    this.users.delete(client.id);
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

  constructor(verifier: AccessTokenVerifier) {
    super(verifier);
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
  ) {
    super(verifier);
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
