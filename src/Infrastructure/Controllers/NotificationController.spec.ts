import { HttpStatus, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { DeleteNotificationUseCase } from "../../UseCases/DeleteNotificationUseCase.js";
import { EmptyTrashUseCase } from "../../UseCases/EmptyTrashUseCase.js";
import { GetInboxUseCase } from "../../UseCases/GetInboxUseCase.js";
import { ManagePreferencesUseCase } from "../../UseCases/ManagePreferencesUseCase.js";
import { MarkAllAsReadUseCase } from "../../UseCases/MarkAllAsReadUseCase.js";
import { MarkAsReadUseCase } from "../../UseCases/MarkAsReadUseCase.js";
import { SendNotificationUseCase } from "../../UseCases/SendNotificationUseCase.js";
import { NotificationController } from "./NotificationController.js";

/**
 * Characterization tests (EV-110 lot 1): they pin the current HTTP contract
 * of every route before access control is added (EV-68). Requests go through
 * `asUser`, so adding a user token later changes one place only.
 */
const INTERNAL_TOKEN = "test-internal-token";

const useCases = {
  send: { execute: vi.fn() },
  inbox: { execute: vi.fn() },
  markAsRead: { execute: vi.fn() },
  markAllAsRead: { execute: vi.fn() },
  emptyTrash: { execute: vi.fn() },
  delete: { execute: vi.fn() },
  preferences: { get: vi.fn(), update: vi.fn() },
};

describe("NotificationController HTTP contract", () => {
  let app: INestApplication;

  const http = () => request(app.getHttpServer());
  // Today the user routes need no credentials; EV-68 adds the user token here
  const asUser = (pending: request.Test) => pending;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: SendNotificationUseCase, useValue: useCases.send },
        { provide: GetInboxUseCase, useValue: useCases.inbox },
        { provide: MarkAsReadUseCase, useValue: useCases.markAsRead },
        { provide: MarkAllAsReadUseCase, useValue: useCases.markAllAsRead },
        { provide: EmptyTrashUseCase, useValue: useCases.emptyTrash },
        { provide: DeleteNotificationUseCase, useValue: useCases.delete },
        { provide: ManagePreferencesUseCase, useValue: useCases.preferences },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NOTIFICATION_INTERNAL_TOKEN", INTERNAL_TOKEN);
  });

  describe("POST /notifications (internal)", () => {
    const body = {
      recipients: { userIds: ["user-1"] },
      templateKey: "welcome",
      variables: { name: "Ana" },
    };

    it("refuses a call without the internal token", async () => {
      await http()
        .post("/notifications")
        .send(body)
        .expect(HttpStatus.UNAUTHORIZED);
      expect(useCases.send.execute).not.toHaveBeenCalled();
    });

    it("refuses a call with a wrong internal token", async () => {
      await http()
        .post("/notifications")
        .set("x-internal-token", "wrong")
        .send(body)
        .expect(HttpStatus.UNAUTHORIZED);
      expect(useCases.send.execute).not.toHaveBeenCalled();
    });

    it("sends a valid notification with defaults filled in", async () => {
      useCases.send.execute.mockResolvedValue({ sent: 1 });

      const response = await http()
        .post("/notifications")
        .set("x-internal-token", INTERNAL_TOKEN)
        .send(body)
        .expect(HttpStatus.CREATED);

      expect(response.body).toEqual({ sent: 1 });
      expect(useCases.send.execute).toHaveBeenCalledWith({
        recipients: { userIds: ["user-1"] },
        templateKey: "welcome",
        variables: { name: "Ana" },
        metadata: {},
        actorId: undefined,
      });
    });

    it.each([
      ["no recipient", { ...body, recipients: {} }],
      [
        "empty recipient lists",
        { ...body, recipients: { userIds: [], roles: [] } },
      ],
      ["an empty template key", { ...body, templateKey: "" }],
      [
        "role recipients",
        { ...body, recipients: { roles: ["administrator"] } },
      ],
      [
        "role recipients next to user ids",
        {
          ...body,
          recipients: { userIds: ["user-1"], roles: ["administrator"] },
        },
      ],
      ["variables that are not an object", { ...body, variables: "Ana" }],
    ])("answers 400 for %s", async (_label, invalid) => {
      await http()
        .post("/notifications")
        .set("x-internal-token", INTERNAL_TOKEN)
        .send(invalid)
        .expect(HttpStatus.BAD_REQUEST);
      expect(useCases.send.execute).not.toHaveBeenCalled();
    });
  });

  describe("GET /notifications", () => {
    it("passes the recipient, page, limit and folder to the use case", async () => {
      useCases.inbox.execute.mockResolvedValue({ data: [], total: 0 });

      const response = await asUser(
        http().get(
          "/notifications?recipientId=user-1&page=2&limit=5&folder=trash",
        ),
      ).expect(HttpStatus.OK);

      expect(response.body).toEqual({ data: [], total: 0 });
      expect(useCases.inbox.execute).toHaveBeenCalledWith({
        recipientId: "user-1",
        page: 2,
        limit: 5,
        folder: "trash",
      });
    });

    it("uses page 1, limit 10 and the inbox by default", async () => {
      useCases.inbox.execute.mockResolvedValue({ data: [], total: 0 });

      await asUser(http().get("/notifications?recipientId=user-1")).expect(
        HttpStatus.OK,
      );

      expect(useCases.inbox.execute).toHaveBeenCalledWith({
        recipientId: "user-1",
        page: 1,
        limit: 10,
        folder: "inbox",
      });
    });

    it("falls back to the defaults for non-numeric page and limit", async () => {
      useCases.inbox.execute.mockResolvedValue({ data: [], total: 0 });

      await asUser(
        http().get("/notifications?recipientId=user-1&page=abc&limit=xyz"),
      ).expect(HttpStatus.OK);

      expect(useCases.inbox.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10 }),
      );
    });
  });

  describe("PATCH /notifications/:id/read", () => {
    it("marks the notification as read and returns the use case result", async () => {
      useCases.markAsRead.execute.mockResolvedValue({
        id: "n-1",
        isRead: true,
      });

      const response = await asUser(
        http().patch("/notifications/n-1/read"),
      ).expect(HttpStatus.OK);

      expect(response.body).toEqual({ id: "n-1", isRead: true });
      expect(useCases.markAsRead.execute).toHaveBeenCalledWith(
        "n-1",
        undefined,
      );
    });
  });

  describe("PATCH /notifications/read-all", () => {
    it("answers 204 and marks the recipient's notifications as read", async () => {
      await asUser(
        http().patch("/notifications/read-all?recipientId=user-1"),
      ).expect(HttpStatus.NO_CONTENT);

      expect(useCases.markAllAsRead.execute).toHaveBeenCalledWith("user-1");
      expect(useCases.markAsRead.execute).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /notifications/trash", () => {
    it("answers 204 and empties the recipient's trash, not a notification named trash", async () => {
      await asUser(
        http().delete("/notifications/trash?recipientId=user-1"),
      ).expect(HttpStatus.NO_CONTENT);

      expect(useCases.emptyTrash.execute).toHaveBeenCalledWith("user-1");
      expect(useCases.delete.execute).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /notifications/:id", () => {
    it("answers 204 and deletes the notification", async () => {
      await asUser(http().delete("/notifications/n-1")).expect(
        HttpStatus.NO_CONTENT,
      );

      expect(useCases.delete.execute).toHaveBeenCalledWith("n-1", undefined);
    });
  });

  describe("/notifications/preferences", () => {
    it("GET returns the recipient's preferences", async () => {
      useCases.preferences.get.mockResolvedValue({ inAppEnabled: true });

      const response = await asUser(
        http().get("/notifications/preferences?recipientId=user-1"),
      ).expect(HttpStatus.OK);

      expect(response.body).toEqual({ inAppEnabled: true });
      expect(useCases.preferences.get).toHaveBeenCalledWith("user-1");
    });

    it("PATCH updates the preferences", async () => {
      useCases.preferences.update.mockResolvedValue({ emailEnabled: false });

      await asUser(
        http()
          .patch("/notifications/preferences?recipientId=user-1")
          .send({ emailEnabled: false, mutedEventTypes: ["bug"] }),
      ).expect(HttpStatus.OK);

      expect(useCases.preferences.update).toHaveBeenCalledWith("user-1", {
        emailEnabled: false,
        mutedEventTypes: ["bug"],
      });
    });

    it.each([
      ["an unknown field", { emailEnabled: true, admin: true }],
      ["a wrong type", { emailEnabled: "yes" }],
    ])("PATCH answers 400 for %s", async (_label, invalid) => {
      await asUser(
        http()
          .patch("/notifications/preferences?recipientId=user-1")
          .send(invalid),
      ).expect(HttpStatus.BAD_REQUEST);

      expect(useCases.preferences.update).not.toHaveBeenCalled();
    });
  });
});
