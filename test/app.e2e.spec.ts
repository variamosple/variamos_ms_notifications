import { HttpStatus } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test, TestingModule } from "@nestjs/testing";
import { SignJWT } from "jose";
import { io, Socket } from "socket.io-client";
import request from "supertest";
import { DataSource } from "typeorm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AppModule } from "./../src/app.module.js";
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  deriveAccessTokenKey,
} from "../src/Infrastructure/Auth/AccessTokenVerifier.js";
import { configureApplication } from "../src/Infrastructure/Config/configureApplication.js";
import { NotificationTemplateEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationTemplateEntity.js";
import { DbTestHelper } from "./db-test-helper.js";

/** What the gateway sends to a connected user, as far as these tests read it */
type SocketNotification = {
  id: string;
  isRead: boolean;
  templateKey: string;
  variables: Record<string, unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Longest wait for a socket event: under the 5 s of a test, so that a missing
// event fails with its name instead of a bare timeout (TST-NOTIF-08)
const SOCKET_WAIT_MS = 3000;

/** The first time `client` emits `event`, or a failure naming it. */
function nextEvent<T>(client: Socket, event: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no "${event}" within ${SOCKET_WAIT_MS} ms`)),
      SOCKET_WAIT_MS,
    );
    client.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

interface PostgresOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

describe("AppModule (e2e)", () => {
  let app: NestExpressApplication;
  let dbHelper: DbTestHelper;
  let dataSource: DataSource;
  const internalToken = "super-secret-internal-token";

  // Access token as issued by variamos_ms_admin (ADR-0001)
  const userToken = (userId: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(deriveAccessTokenKey(internalToken));
  const asUser = async (userId: string) => ({
    Authorization: `Bearer ${await userToken(userId)}`,
  });

  beforeAll(async () => {
    dbHelper = new DbTestHelper();
    dataSource = await dbHelper.start();
    await dataSource.query("CREATE SCHEMA IF NOT EXISTS variamos;");

    // Stubbed for the whole file, and given back after it (TST-NOTIF-11)
    const options = dataSource.options as PostgresOptions;
    vi.stubEnv("DATABASE_HOST", options.host);
    vi.stubEnv("DATABASE_PORT", String(options.port));
    vi.stubEnv("DATABASE_USERNAME", options.username);
    vi.stubEnv("DATABASE_PASSWORD", options.password);
    vi.stubEnv("DATABASE_NAME", options.database);
    vi.stubEnv("NOTIFICATION_INTERNAL_TOKEN", internalToken);
  }, 60000);

  beforeEach(async () => {
    await dbHelper.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Built as main.ts builds it: hardening and socket adapter included
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();

    // Create a default template in the database for the tests
    const templateRepo = dataSource.getRepository(NotificationTemplateEntity);
    const template = new NotificationTemplateEntity();
    template.key = "test_template";
    template.titleTemplate = "Hello {{name}}";
    template.bodyTemplate = "You have a new alert.";
    await templateRepo.save(template);
  });

  // Sockets opened by a test, closed after it even when it fails
  const sockets: Socket[] = [];
  const openSocket = (url: string, options: Parameters<typeof io>[1]) => {
    const client = io(url, { ...options, autoConnect: false });
    sockets.push(client);
    return client;
  };

  afterEach(async () => {
    for (const client of sockets.splice(0)) {
      client.close();
    }
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await dbHelper.stop();
  });

  it("starts with its database reachable", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .expect(HttpStatus.OK);
    expect(response.body).toMatchObject({
      status: "UP",
      serviceName: "variamos_ms_notifications",
      checks: { database: { status: "UP" } },
    });
  });

  it("answers with the settings of main.ts: security headers, body limit (TST-NOTIF-07)", async () => {
    const response = await request(app.getHttpServer())
      .post("/notifications")
      .set("x-internal-token", internalToken)
      .send({ padding: "x".repeat(150 * 1024) })
      .expect(HttpStatus.PAYLOAD_TOO_LARGE);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  describe("HTTP API", () => {
    it("POST /notifications should fail if token is missing or invalid", async () => {
      const response = await request(app.getHttpServer())
        .post("/notifications")
        .send({
          recipients: { userIds: ["user-1"] },
          templateKey: "test_template",
          variables: { name: "Nathan" },
        });
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("POST /notifications should validate input using Zod and return 201 on success", async () => {
      const response = await request(app.getHttpServer())
        .post("/notifications")
        .set("x-internal-token", internalToken)
        .send({
          recipients: { userIds: ["user-1"] },
          templateKey: "test_template",
          variables: { name: "Nathan" },
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].recipientId).toBe("user-1");
      expect(response.body[0].isRead).toBe(false);
    });

    it("GET /notifications should retrieve inbox notifications paginated", async () => {
      // First populate one notification
      await request(app.getHttpServer())
        .post("/notifications")
        .set("x-internal-token", internalToken)
        .send({
          recipients: { userIds: ["user-1"] },
          templateKey: "test_template",
          variables: { name: "Nathan" },
        });

      const response = await request(app.getHttpServer())
        .get("/notifications?page=1&limit=5&folder=inbox")
        .set(await asUser("user-1"))
        .expect(HttpStatus.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].recipientId).toBe("user-1");
    });

    it("DELETE /notifications/:id should move the notification to trash", async () => {
      // 1. Create a notification
      const createResponse = await request(app.getHttpServer())
        .post("/notifications")
        .set("x-internal-token", internalToken)
        .send({
          recipients: { userIds: ["user-1"] },
          templateKey: "test_template",
          variables: { name: "Nathan" },
        })
        .expect(HttpStatus.CREATED);

      const notifId = createResponse.body[0].id;

      // 2. Delete it
      await request(app.getHttpServer())
        .delete(`/notifications/${notifId}`)
        .set(await asUser("user-1"))
        .expect(HttpStatus.NO_CONTENT);

      // 3. Verify it is no longer in inbox
      const inboxResponse = await request(app.getHttpServer())
        .get("/notifications?page=1&limit=5&folder=inbox")
        .set(await asUser("user-1"))
        .expect(HttpStatus.OK);
      expect(inboxResponse.body).toHaveLength(0);

      // 4. Verify it is in trash
      const trashResponse = await request(app.getHttpServer())
        .get("/notifications?page=1&limit=5&folder=trash")
        .set(await asUser("user-1"))
        .expect(HttpStatus.OK);
      expect(trashResponse.body).toHaveLength(1);
      expect(trashResponse.body[0].id).toBe(notifId);
    });
  });

  describe("Access control (enforce mode)", () => {
    it("refuses a user route without access token", async () => {
      const response = await request(app.getHttpServer()).get(
        "/notifications?recipientId=user-1",
      );
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("refuses a forged access token", async () => {
      const forged = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-1")
        .setIssuer(ACCESS_TOKEN_ISSUER)
        .setAudience(ACCESS_TOKEN_AUDIENCE)
        .setExpirationTime("15m")
        .sign(deriveAccessTokenKey("another-secret"));

      const response = await request(app.getHttpServer())
        .get("/notifications")
        .set("Authorization", `Bearer ${forged}`);
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("never lists another user's notifications, whatever recipientId says", async () => {
      await request(app.getHttpServer())
        .post("/notifications")
        .set("x-internal-token", internalToken)
        .send({
          recipients: { userIds: ["user-1"] },
          templateKey: "test_template",
          variables: { name: "Nathan" },
        })
        .expect(HttpStatus.CREATED);

      const response = await request(app.getHttpServer())
        .get("/notifications?recipientId=user-1")
        .set(await asUser("user-2"))
        .expect(HttpStatus.OK);

      expect(response.body).toHaveLength(0);
    });

    it("gives nothing twice when a send is repeated with its key (EV-99, CA-NT-05)", async () => {
      const send = (userIds: string[]) =>
        request(app.getHttpServer())
          .post("/notifications")
          .set("x-internal-token", internalToken)
          .send({
            recipients: { userIds },
            templateKey: "test_template",
            variables: { name: "Nathan" },
            eventId: "announcement-42",
          })
          .expect(HttpStatus.CREATED);

      expect((await send(["user-1"])).body).toHaveLength(1);
      // Repeated after a timeout, with one more recipient
      const again = await send(["user-1", "user-2"]);

      expect(
        again.body.map((n: { recipientId: string }) => n.recipientId),
      ).toEqual(["user-2"]);
      expect(
        await dataSource.query(
          `SELECT recipient_id FROM variamos.notifications WHERE event_id = 'announcement-42' ORDER BY 1`,
        ),
      ).toEqual([{ recipient_id: "user-1" }, { recipient_id: "user-2" }]);
    });

    it("keeps the health check open", async () => {
      const response = await request(app.getHttpServer()).get("/health");
      expect(response.status).toBe(HttpStatus.OK);
    });

    it("disconnects a socket without access token, even with a userId", async () => {
      await app.listen(0);
      const serverUrl = await app.getUrl();
      const wsClient = openSocket(serverUrl, { query: { userId: "user-1" } });

      const disconnected = nextEvent<string>(wsClient, "disconnect");
      wsClient.connect();

      await expect(disconnected).resolves.toBe("io server disconnect");
    });
  });

  describe("WebSockets", () => {
    it("should dispatch notification to connected WebSocket clients in real-time", async () => {
      // Socket.io needs a listening HTTP server, start NestJS on a random port
      await app.listen(0);
      const serverUrl = await app.getUrl();

      const wsClient = openSocket(serverUrl, {
        auth: { token: await userToken("user-ws-1") },
      });

      const connected = nextEvent<void>(wsClient, "connect");
      wsClient.connect();
      await connected;

      const notificationReceived = nextEvent<SocketNotification>(
        wsClient,
        "notification",
      );

      // Post notification to user-ws-1 via HTTP endpoint
      await request(app.getHttpServer())
        .post("/notifications")
        .set("x-internal-token", internalToken)
        .send({
          recipients: { userIds: ["user-ws-1"] },
          templateKey: "test_template",
          variables: { name: "WS Tester" },
        })
        .expect(HttpStatus.CREATED);

      const receivedPayload = await notificationReceived;
      // A new, unread notification, sent to the room of its recipient
      expect(receivedPayload.id).toMatch(UUID);
      expect(receivedPayload.isRead).toBe(false);
      expect(receivedPayload.templateKey).toBe("test_template");
      expect(receivedPayload.variables).toEqual({ name: "WS Tester" });
    });

    it("should dispatch notification when client connects with /variamos_ms_notifications namespace", async () => {
      await app.listen(0);
      const serverUrl = await app.getUrl();

      const wsClient = openSocket(`${serverUrl}/variamos_ms_notifications`, {
        auth: { token: await userToken("user-ws-2") },
      });

      const connected = nextEvent<void>(wsClient, "connect");
      wsClient.connect();
      await connected;

      const notificationReceived = nextEvent<SocketNotification>(
        wsClient,
        "notification",
      );

      await request(app.getHttpServer())
        .post("/notifications")
        .set("x-internal-token", internalToken)
        .send({
          recipients: { userIds: ["user-ws-2"] },
          templateKey: "test_template",
          variables: { name: "Namespace Tester" },
        })
        .expect(HttpStatus.CREATED);

      const receivedPayload = await notificationReceived;
      // A new, unread notification, sent to the room of its recipient
      expect(receivedPayload.id).toMatch(UUID);
      expect(receivedPayload.isRead).toBe(false);
      expect(receivedPayload.templateKey).toBe("test_template");
      expect(receivedPayload.variables).toEqual({ name: "Namespace Tester" });
    });
  });
});
