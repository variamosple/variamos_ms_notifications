import { HttpStatus, type INestApplication, Logger } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
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
import { Notification } from "../../Domain/Entities/Notification.js";
import { UserPreferences } from "../../Domain/Entities/UserPreferences.js";
import type { INotificationRepository } from "../../Domain/Repositories/INotificationRepository.js";
import type { IUserPreferencesRepository } from "../../Domain/Repositories/IUserPreferencesRepository.js";
import { DeleteNotificationUseCase } from "../../UseCases/DeleteNotificationUseCase.js";
import { EmptyTrashUseCase } from "../../UseCases/EmptyTrashUseCase.js";
import { GetInboxUseCase } from "../../UseCases/GetInboxUseCase.js";
import { ManagePreferencesUseCase } from "../../UseCases/ManagePreferencesUseCase.js";
import { MarkAllAsReadUseCase } from "../../UseCases/MarkAllAsReadUseCase.js";
import { MarkAsReadUseCase } from "../../UseCases/MarkAsReadUseCase.js";
import { SendNotificationUseCase } from "../../UseCases/SendNotificationUseCase.js";
import { ACCESS_CONTROL_MODE_TOKEN } from "../Auth/AccessControlMode.js";
import { AccessTokenVerifier } from "../Auth/AccessTokenVerifier.js";
import { UserAccessGuard } from "../Auth/UserAccessGuard.js";
import { NotificationController } from "./NotificationController.js";

/**
 * Ownership (EV-68 lot 2, CA-NT-01, CA-NT-03): with a valid access token,
 * a user only reads and changes its own notifications and preferences,
 * whatever recipientId the query names. Real use cases, in-memory data.
 */
class InMemoryNotifications implements INotificationRepository {
  public rows = new Map<string, Notification>();

  public async save(n: Notification) {
    this.rows.set(n.id, n);
    return n;
  }
  public async saveMany(list: Notification[]) {
    for (const n of list) this.rows.set(n.id, n);
    return list;
  }
  public async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  public async findByRecipient(recipientId: string) {
    return [...this.rows.values()].filter((n) => n.recipientId === recipientId);
  }
  public async countUnread(recipientId: string) {
    return (await this.findByRecipient(recipientId)).filter((n) => !n.isRead)
      .length;
  }
  public async markAllAsRead(recipientId: string) {
    for (const n of await this.findByRecipient(recipientId)) n.markAsRead();
  }
  public async emptyTrash(recipientId: string) {
    for (const n of await this.findByRecipient(recipientId)) {
      if (n.deletedAt) this.rows.delete(n.id);
    }
  }
  public async delete(id: string) {
    this.rows.get(id)?.moveToTrash();
  }
}

class InMemoryPreferences implements IUserPreferencesRepository {
  public rows = new Map<string, UserPreferences>();

  public async findByUserId(userId: string) {
    return this.rows.get(userId) ?? null;
  }
  public async findByUserIds(userIds: string[]) {
    return userIds.flatMap((id) => this.rows.get(id) ?? []);
  }
  public async save(preferences: UserPreferences) {
    this.rows.set(preferences.userId, preferences);
    return preferences;
  }
}

const A1 = "aaaaaaaa-1111-4111-8111-111111111111";
const B1 = "bbbbbbbb-1111-4111-8111-111111111111";
const MISSING = "cccccccc-1111-4111-8111-111111111111";

const notificationOf = (id: string, recipientId: string) =>
  new Notification(
    id,
    recipientId,
    null,
    "welcome",
    {},
    {},
    false,
    null,
    new Date(),
  );

// "token-a" is user-a's valid access token
const verifier = {
  verify: async (token: string | null | undefined) =>
    token === "token-a" ? { userId: "user-a" } : null,
};

describe("Notification ownership with an access token", () => {
  let app: INestApplication;
  const notifications = new InMemoryNotifications();
  const preferences = new InMemoryPreferences();

  const http = () => request(app.getHttpServer());
  const asUserA = (pending: request.Test) =>
    pending.set("Authorization", "Bearer token-a");

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: SendNotificationUseCase, useValue: { execute: vi.fn() } },
        {
          provide: GetInboxUseCase,
          useValue: new GetInboxUseCase(notifications),
        },
        {
          provide: MarkAsReadUseCase,
          useValue: new MarkAsReadUseCase(notifications),
        },
        {
          provide: MarkAllAsReadUseCase,
          useValue: new MarkAllAsReadUseCase(notifications),
        },
        {
          provide: EmptyTrashUseCase,
          useValue: new EmptyTrashUseCase(notifications),
        },
        {
          provide: DeleteNotificationUseCase,
          useValue: new DeleteNotificationUseCase(notifications),
        },
        {
          provide: ManagePreferencesUseCase,
          useValue: new ManagePreferencesUseCase(preferences),
        },
        { provide: AccessTokenVerifier, useValue: verifier },
        { provide: ACCESS_CONTROL_MODE_TOKEN, useValue: "observe" },
        { provide: APP_GUARD, useClass: UserAccessGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    notifications.rows.clear();
    preferences.rows.clear();
    await notifications.saveMany([
      notificationOf(A1, "user-a"),
      notificationOf(B1, "user-b"),
    ]);
  });

  it("lists only the token user's notifications, whatever recipientId says", async () => {
    const response = await asUserA(
      http().get("/notifications?recipientId=user-b"),
    ).expect(HttpStatus.OK);

    expect(response.body.map((n: { id: string }) => n.id)).toEqual([A1]);
  });

  it("answers 404 when marking another user's notification as read", async () => {
    await asUserA(http().patch(`/notifications/${B1}/read`)).expect(
      HttpStatus.NOT_FOUND,
    );

    expect(notifications.rows.get(B1)?.isRead).toBe(false);
  });

  it("marks the token user's own notification as read", async () => {
    await asUserA(http().patch(`/notifications/${A1}/read`)).expect(
      HttpStatus.OK,
    );

    expect(notifications.rows.get(A1)?.isRead).toBe(true);
  });

  it("answers 404 when deleting another user's notification", async () => {
    await asUserA(http().delete(`/notifications/${B1}`)).expect(
      HttpStatus.NOT_FOUND,
    );

    expect(notifications.rows.get(B1)?.deletedAt).toBeNull();
  });

  it("answers 404, not 500, for a notification that does not exist", async () => {
    const response = await asUserA(
      http().patch(`/notifications/${MISSING}/read`),
    ).expect(HttpStatus.NOT_FOUND);

    expect(response.body.errorCode).toBe("NOTIFICATION_NOT_FOUND");
  });

  it("marks all as read only for the token user", async () => {
    await asUserA(
      http().patch("/notifications/read-all?recipientId=user-b"),
    ).expect(HttpStatus.NO_CONTENT);

    expect(notifications.rows.get(A1)?.isRead).toBe(true);
    expect(notifications.rows.get(B1)?.isRead).toBe(false);
  });

  it("updates only the token user's preferences", async () => {
    await asUserA(
      http()
        .patch("/notifications/preferences?recipientId=user-b")
        .send({ emailEnabled: false }),
    ).expect(HttpStatus.OK);

    expect(preferences.rows.has("user-a")).toBe(true);
    expect(preferences.rows.has("user-b")).toBe(false);
  });

  describe("without a token (observe mode)", () => {
    it("still serves the recipient of the query", async () => {
      const response = await http()
        .get("/notifications?recipientId=user-b")
        .expect(HttpStatus.OK);

      expect(response.body.map((n: { id: string }) => n.id)).toEqual([B1]);
    });

    it.each([
      ["GET", "/notifications"],
      ["PATCH", "/notifications/read-all"],
      ["DELETE", "/notifications/trash"],
      ["GET", "/notifications/preferences"],
    ])("answers 400 for %s %s without any recipient", async (method, url) => {
      const pending =
        method === "GET"
          ? http().get(url)
          : method === "PATCH"
            ? http().patch(url)
            : http().delete(url);

      const response = await pending.expect(HttpStatus.BAD_REQUEST);
      expect(response.body.errorCode).toBe("MISSING_RECIPIENT");
      expect(notifications.rows.get(A1)?.isRead).toBe(false);
      expect(notifications.rows.get(B1)?.isRead).toBe(false);
    });
  });
});
