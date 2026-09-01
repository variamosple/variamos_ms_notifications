import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, HttpStatus } from "@nestjs/common";
import request from "supertest";
import { io, Socket } from "socket.io-client";
import { AppModule } from "./../src/app.module.js";
import { DbTestHelper } from "./db-test-helper.js";
import { NotificationTemplate } from "../src/Domain/Entities/NotificationTemplate.js";
import { NotificationTemplateEntity } from "../src/Infrastructure/Persistence/TypeORM/Entities/NotificationTemplateEntity.js";
import { DataSource } from "typeorm";

interface PostgresOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

describe("AppModule (e2e)", () => {
  let app: INestApplication;
  let dbHelper: DbTestHelper;
  let dataSource: DataSource;
  const internalToken = "super-secret-internal-token";

  beforeAll(async () => {
    dbHelper = new DbTestHelper();
    dataSource = await dbHelper.start();
    await dataSource.query("CREATE SCHEMA IF NOT EXISTS variamos;");

    process.env.DATABASE_HOST = (dataSource.options as PostgresOptions).host;
    process.env.DATABASE_PORT = String((dataSource.options as PostgresOptions).port);
    process.env.DATABASE_USERNAME = (dataSource.options as PostgresOptions).username;
    process.env.DATABASE_PASSWORD = (dataSource.options as PostgresOptions).password;
    process.env.DATABASE_NAME = (dataSource.options as PostgresOptions).database;
    process.env.NOTIFICATION_INTERNAL_TOKEN = internalToken;
  }, 60000);

  beforeEach(async () => {
    await dbHelper.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create a default template in the database for the tests
    const templateRepo = dataSource.getRepository(NotificationTemplateEntity);
    const template = new NotificationTemplateEntity();
    template.key = "test_template";
    template.titleTemplate = "Hello {{name}}";
    template.bodyTemplate = "You have a new alert.";
    await templateRepo.save(template);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    await dbHelper.stop();
  });

  it("should initialize the application successfully", () => {
    expect(app).toBeDefined();
  });

  describe("HTTP API", () => {
    it("POST /notifications should fail if token is missing or invalid", async () => {
      await request(app.getHttpServer())
        .post("/notifications")
        .send({
          recipients: { userIds: ["user-1"] },
          templateKey: "test_template",
          variables: { name: "Nathan" },
        })
        .expect(HttpStatus.UNAUTHORIZED);
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
        .get("/notifications?recipientId=user-1&page=1&limit=5&folder=inbox")
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
        .expect(HttpStatus.NO_CONTENT);

      // 3. Verify it is no longer in inbox
      const inboxResponse = await request(app.getHttpServer())
        .get("/notifications?recipientId=user-1&page=1&limit=5&folder=inbox")
        .expect(HttpStatus.OK);
      expect(inboxResponse.body).toHaveLength(0);

      // 4. Verify it is in trash
      const trashResponse = await request(app.getHttpServer())
        .get("/notifications?recipientId=user-1&page=1&limit=5&folder=trash")
        .expect(HttpStatus.OK);
      expect(trashResponse.body).toHaveLength(1);
      expect(trashResponse.body[0].id).toBe(notifId);
    });
  });

  describe("WebSockets", () => {
    it("should dispatch notification to connected WebSocket clients in real-time", async () => {
      // Socket.io needs a listening HTTP server, start NestJS on a random port
      await app.listen(0);
      const serverUrl = await app.getUrl();

      const wsClient: Socket = io(serverUrl, {
        autoConnect: false,
        query: { userId: "user-ws-1" },
      });

      const connected = new Promise<void>((resolve) => {
        wsClient.on("connect", () => resolve());
      });
      wsClient.connect();
      await connected;

      const notificationReceived = new Promise<any>((resolve) => {
        wsClient.on("notification", (data) => {
          resolve(data);
        });
      });

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
      expect(receivedPayload).toBeDefined();
      expect(receivedPayload.templateKey).toBe("test_template");
      expect(receivedPayload.variables).toEqual({ name: "WS Tester" });

      wsClient.disconnect();
    });

    it("should dispatch notification when client connects with /variamos_ms_notifications namespace", async () => {
      await app.listen(0);
      const serverUrl = await app.getUrl();

      const wsClient: Socket = io(`${serverUrl}/variamos_ms_notifications`, {
        autoConnect: false,
        query: { userId: "user-ws-2" },
      });

      const connected = new Promise<void>((resolve) => {
        wsClient.on("connect", () => resolve());
      });
      wsClient.connect();
      await connected;

      const notificationReceived = new Promise<any>((resolve) => {
        wsClient.on("notification", (data) => {
          resolve(data);
        });
      });

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
      expect(receivedPayload).toBeDefined();
      expect(receivedPayload.templateKey).toBe("test_template");
      expect(receivedPayload.variables).toEqual({ name: "Namespace Tester" });

      wsClient.disconnect();
    });
  });
});
