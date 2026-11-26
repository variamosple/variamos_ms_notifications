import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Logger } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notification } from "../../Domain/Entities/Notification.js";
import type { AccessTokenVerifier } from "../Auth/AccessTokenVerifier.js";
import {
  NotificationGateway,
  RootNotificationGateway,
} from "./NotificationGateway.js";

/**
 * How both gateways accept connections and route events (EV-110, EV-68):
 * a client joins the room of its access token's user, never a userId it
 * gives (TRV-66). The sockets and servers are fakes: no network is used.
 */
const fakeSocket = (handshake: {
  auth?: Record<string, unknown>;
  query?: Record<string, unknown>;
}) =>
  ({
    id: "socket-1",
    handshake: { auth: {}, query: {}, ...handshake },
    join: vi.fn(),
    disconnect: vi.fn(),
    conn: { close: vi.fn() },
  }) as unknown as Socket & {
    join: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    conn: { close: ReturnType<typeof vi.fn> };
  };

const fakeServer = () => {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { server: { to } as unknown as Server, to, emit };
};

// When "valid-token" expires: far enough for the tests that do not wait
let tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

// Verifier that knows one token: "valid-token" for "user-from-token"
const verifier = {
  verifyAccess: vi.fn(async (token: string | null | undefined) =>
    token === "valid-token"
      ? { userId: "user-from-token", expiresAt: tokenExpiresAt }
      : null,
  ),
} as unknown as AccessTokenVerifier;

const rootGateway = () => new RootNotificationGateway(verifier);
const namespaceGateway = () => new NotificationGateway(rootGateway(), verifier);

const setServer = (gateway: object, server: Server) => {
  (gateway as { server: Server }).server = server;
};

const notification = () =>
  new Notification({
    id: "n-1",
    recipientId: "user-1",
    actorId: "actor-1",
    templateKey: "welcome",
    variables: { name: "Ana" },
    metadata: { source: "admin" },
    read: false,
    readTime: null,
    createdAt: new Date("2026-10-16T10:00:00Z"),
  });

describe.each([
  ["RootNotificationGateway", rootGateway],
  ["NotificationGateway", namespaceGateway],
])("%s connections", (_name, createGateway) => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("disconnects a client without a token", async () => {
    const client = fakeSocket({});

    await createGateway().handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it.each([
    ["the handshake auth", { auth: { userId: "user-1" } }],
    ["the query", { query: { userId: "user-1" } }],
    ["the query, as a list", { query: { userId: ["user-1", "user-2"] } }],
  ])(
    "disconnects a client that only gives a userId in %s",
    async (_where, handshake) => {
      const client = fakeSocket(handshake);

      await createGateway().handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    },
  );

  it("disconnects a client with a forged token, even with a userId", async () => {
    const client = fakeSocket({
      auth: { token: "forged-token", userId: "user-1" },
    });

    await createGateway().handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it("disconnects a client whose token is not a string", async () => {
    const client = fakeSocket({ auth: { token: ["valid-token"] } });

    await createGateway().handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it("accepts a client with a valid token", async () => {
    const client = fakeSocket({ auth: { token: "valid-token" } });

    await createGateway().handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("user-from-token");
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("joins the room of the token's user, ignoring the userId given", async () => {
    const client = fakeSocket({
      auth: { token: "valid-token", userId: "someone-else" },
      query: { userId: "someone-else" },
    });

    await createGateway().handleConnection(client);

    expect(client.join).toHaveBeenCalledOnce();
    expect(client.join).toHaveBeenCalledWith("user-from-token");
  });

  it("logs the disconnection under the token's user, not the userId given", async () => {
    const log = vi.mocked(Logger.prototype.log);
    const client = fakeSocket({
      auth: { token: "valid-token", userId: "someone-else" },
    });
    const gateway = createGateway();
    await gateway.handleConnection(client);
    log.mockClear();

    gateway.handleDisconnect(client);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("disconnected: userId=user-from-token"),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("someone-else");
  });

  it("logs nothing when a refused client disconnects", async () => {
    const log = vi.mocked(Logger.prototype.log);
    const client = fakeSocket({ auth: { userId: "user-1" } });
    const gateway = createGateway();
    await gateway.handleConnection(client);
    log.mockClear();

    gateway.handleDisconnect(client);

    expect(log).not.toHaveBeenCalled();
  });
});

describe.each([
  ["RootNotificationGateway", rootGateway],
  ["NotificationGateway", namespaceGateway],
])("%s at the end of the access token (ADM-N19)", (_name, createGateway) => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    tokenExpiresAt = new Date(Date.now() + 60_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("closes the connection when the token expires, not before", async () => {
    const client = fakeSocket({ auth: { token: "valid-token" } });

    await createGateway().handleConnection(client);
    vi.advanceTimersByTime(59_999);
    expect(client.conn.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    // The transport, so that the client connects again with a new token
    expect(client.conn.close).toHaveBeenCalledOnce();
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("forgets the end of a socket that disconnects first", async () => {
    const client = fakeSocket({ auth: { token: "valid-token" } });
    const gateway = createGateway();

    await gateway.handleConnection(client);
    gateway.handleDisconnect(client);
    vi.advanceTimersByTime(120_000);

    expect(client.conn.close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("NotificationGateway.send", () => {
  it("emits a reduced payload to the recipient's room on both namespaces", async () => {
    const root = rootGateway();
    const gateway = new NotificationGateway(root, verifier);
    const namespace = fakeServer();
    const rootServer = fakeServer();
    setServer(gateway, namespace.server);
    setServer(root, rootServer.server);

    await gateway.send(notification());

    const payload = {
      id: "n-1",
      templateKey: "welcome",
      variables: { name: "Ana" },
      metadata: { source: "admin" },
      isRead: false,
      createdAt: new Date("2026-10-16T10:00:00Z"),
    };
    expect(namespace.to).toHaveBeenCalledWith("user-1");
    expect(namespace.emit).toHaveBeenCalledWith("notification", payload);
    expect(rootServer.to).toHaveBeenCalledWith("user-1");
    expect(rootServer.emit).toHaveBeenCalledWith("notification", payload);
    // Once per namespace: a client connected to one receives it once
    expect(namespace.emit).toHaveBeenCalledTimes(1);
    expect(rootServer.emit).toHaveBeenCalledTimes(1);
  });

  // CA-NT-18: the same example is kept in variamos_components
  // (lib/Context/notification-realtime.example.json), whose test reads it as
  // the browser receives it. A change here must be made there too.
  it("emits, once serialized, the message of the shared example", async () => {
    const example: unknown = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "notification-realtime.example.json"),
        "utf8",
      ),
    );
    const gateway = namespaceGateway();
    const namespace = fakeServer();
    setServer(gateway, namespace.server);

    await gateway.send(notification());

    const [, payload] = namespace.emit.mock.calls[0] as [string, object];
    // Socket.IO sends JSON: the date arrives as an ISO text
    expect(JSON.parse(JSON.stringify(payload))).toEqual(example);
  });

  it("does not expose the recipient or the actor in the payload", async () => {
    const gateway = namespaceGateway();
    const namespace = fakeServer();
    setServer(gateway, namespace.server);

    await gateway.send(notification());

    const [, payload] = namespace.emit.mock.calls[0] as [string, object];
    expect(payload).not.toHaveProperty("recipientId");
    expect(payload).not.toHaveProperty("actorId");
  });

  it("does nothing before the servers are initialized", async () => {
    const gateway = namespaceGateway();

    await expect(gateway.send(notification())).resolves.toBeUndefined();
  });
});
