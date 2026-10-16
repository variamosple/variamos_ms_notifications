import { Logger } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notification } from "../../Domain/Entities/Notification.js";
import type { AccessControlMode } from "../Auth/AccessControlMode.js";
import type { AccessTokenVerifier } from "../Auth/AccessTokenVerifier.js";
import {
  NotificationGateway,
  RootNotificationGateway,
} from "./NotificationGateway.js";

/**
 * Characterization tests (EV-110 lot 1): they pin how both gateways accept
 * connections and route events today, before the handshake is authenticated
 * (EV-68). The sockets and servers are fakes: no network is used.
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
  }) as unknown as Socket & {
    join: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };

const fakeServer = () => {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { server: { to } as unknown as Server, to, emit };
};

// Verifier that knows one token: "valid-token" for "user-from-token"
const verifier = {
  verify: vi.fn(async (token: string | null | undefined) =>
    token === "valid-token" ? { userId: "user-from-token" } : null,
  ),
} as unknown as AccessTokenVerifier;

const rootGateway = (mode: AccessControlMode = "observe") =>
  new RootNotificationGateway(verifier, mode);
const namespaceGateway = (mode: AccessControlMode = "observe") =>
  new NotificationGateway(rootGateway(mode), verifier, mode);

const setServer = (gateway: object, server: Server) => {
  (gateway as { server: Server }).server = server;
};

const notification = () =>
  new Notification(
    "n-1",
    "user-1",
    "actor-1",
    "welcome",
    { name: "Ana" },
    { source: "admin" },
    false,
    null,
    new Date("2026-10-16T10:00:00Z"),
  );

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

  it("disconnects a client that gives no userId", async () => {
    const client = fakeSocket({});

    await createGateway().handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it("disconnects a client whose userId is blank", async () => {
    const client = fakeSocket({ auth: { userId: "   " } });

    await createGateway().handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it("joins the room of the userId given in the handshake auth", async () => {
    const client = fakeSocket({ auth: { userId: " user-1 " } });

    await createGateway().handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("user-1");
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("falls back to the userId of the query, first value only", async () => {
    const client = fakeSocket({ query: { userId: ["user-2", "user-3"] } });

    await createGateway().handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("user-2");
  });

  it("joins the room of the token's user, ignoring the userId given", async () => {
    const client = fakeSocket({
      auth: { token: "valid-token", userId: "someone-else" },
    });

    await createGateway().handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("user-from-token");
    expect(client.join).not.toHaveBeenCalledWith("someone-else");
  });

  it("in enforce mode, refuses a client without a valid token even with a userId", async () => {
    const client = fakeSocket({
      auth: { token: "forged-token", userId: "user-1" },
    });

    await createGateway("enforce").handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it("in enforce mode, accepts a client with a valid token", async () => {
    const client = fakeSocket({ auth: { token: "valid-token" } });

    await createGateway("enforce").handleConnection(client);

    expect(client.join).toHaveBeenCalledWith("user-from-token");
  });
});

describe("NotificationGateway.send", () => {
  it("emits a reduced payload to the recipient's room on both namespaces", async () => {
    const root = rootGateway();
    const gateway = new NotificationGateway(root, verifier, "observe");
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
