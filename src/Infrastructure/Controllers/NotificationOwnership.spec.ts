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
import { RestoreNotificationUseCase } from "../../UseCases/RestoreNotificationUseCase.js";
import { SendNotificationUseCase } from "../../UseCases/SendNotificationUseCase.js";
import { AccessTokenVerifier } from "../Auth/AccessTokenVerifier.js";
import { UserAccessGuard } from "../Auth/UserAccessGuard.js";
import { NOTIFICATION_CONTROLLERS } from "./notificationControllers.js";

/**
 * Ownership (EV-68 lot 2, CA-NT-01, CA-NT-03, TRV-66): with a valid access
 * token, a user only reads and changes its own notifications and
 * preferences, whatever recipientId the query names; without one, nothing
 * is served or changed. Real use cases, in-memory data.
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
    const notifications = await this.findByRecipient(recipientId);
    return notifications.filter((n) => !n.isRead).length;
  }
  public async markAllAsRead(recipientId: string) {
    const notifications = await this.findByRecipient(recipientId);
    for (const n of notifications) n.markAsRead();
  }
  public async emptyTrash(recipientId: string) {
    const notifications = await this.findByRecipient(recipientId);
    for (const n of notifications) {
      if (n.deletedAt) this.rows.delete(n.id);
    }
  }
  public async purgeTrashedBefore(cutoff: Date) {
    const old = [...this.rows.values()].filter(
      (n) => n.deletedAt && n.deletedAt < cutoff,
    );
    for (const n of old) this.rows.delete(n.id);
    return old.length;
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
  new Notification({
    id,
    recipientId,
    actorId: null,
    templateKey: "welcome",
    variables: {},
    metadata: {},
    read: false,
    readTime: null,
    createdAt: new Date(),
  });

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
      controllers: NOTIFICATION_CONTROLLERS,
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
          provide: RestoreNotificationUseCase,
          useValue: new RestoreNotificationUseCase(notifications),
        },
        {
          provide: ManagePreferencesUseCase,
          useValue: new ManagePreferencesUseCase(preferences),
        },
        { provide: AccessTokenVerifier, useValue: verifier },
        { provide: APP_GUARD, useClass: UserAccessGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    notifications.rows.clear();
    preferences.rows.clear();
    await notifications.saveMany([
      notificationOf(A1, "user-a"),
      notificationOf(B1, "user-b"),
    ]);
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
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

  it("restores the token user's own notification from the trash", async () => {
    notifications.rows.get(A1)?.moveToTrash();

    const response = await asUserA(
      http().patch(`/notifications/${A1}/restore`),
    ).expect(HttpStatus.OK);

    expect(response.body).toMatchObject({ id: A1, deletedAt: null });
    expect(notifications.rows.get(A1)?.deletedAt).toBeNull();
  });

  it("answers 404 when restoring another user's notification", async () => {
    notifications.rows.get(B1)?.moveToTrash();

    await asUserA(http().patch(`/notifications/${B1}/restore`)).expect(
      HttpStatus.NOT_FOUND,
    );

    expect(notifications.rows.get(B1)?.deletedAt).not.toBeNull();
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

  it("empties only the token user's trash", async () => {
    notifications.rows.get(A1)?.moveToTrash();
    notifications.rows.get(B1)?.moveToTrash();

    await asUserA(
      http().delete("/notifications/trash?recipientId=user-b"),
    ).expect(HttpStatus.NO_CONTENT);

    expect(notifications.rows.has(A1)).toBe(false);
    expect(notifications.rows.has(B1)).toBe(true);
  });

  it("reads only the token user's preferences", async () => {
    preferences.rows.set("user-b", UserPreferences.defaultsFor("user-b"));
    preferences.rows.get("user-b")?.disableEmail();

    const response = await asUserA(
      http().get("/notifications/preferences?recipientId=user-b"),
    ).expect(HttpStatus.OK);

    expect(response.body).toMatchObject({
      userId: "user-a",
      emailEnabled: true,
    });
  });

  describe("without a token", () => {
    it.each([
      ["GET", "/notifications?recipientId=user-b"],
      ["GET", "/notifications?userId=user-b"],
      ["PATCH", "/notifications/read-all?recipientId=user-b"],
      ["DELETE", "/notifications/trash?recipientId=user-b"],
      ["GET", "/notifications/preferences?recipientId=user-b"],
      ["PATCH", "/notifications/preferences?recipientId=user-b"],
      ["PATCH", `/notifications/${B1}/read`],
      ["DELETE", `/notifications/${B1}`],
      ["PATCH", `/notifications/${B1}/restore`],
    ] as const)(
      "answers 401 to %s %s and changes nothing",
      async (method, url) => {
        const send = {
          GET: () => http().get(url),
          PATCH: () => http().patch(url).send({ emailEnabled: false }),
          DELETE: () => http().delete(url),
        }[method];

        const response = await send().expect(HttpStatus.UNAUTHORIZED);

        expect(JSON.stringify(response.body)).not.toContain(B1);
        expect(notifications.rows.get(B1)).toMatchObject({
          isRead: false,
          deletedAt: null,
        });
        expect(preferences.rows.has("user-b")).toBe(false);
      },
    );
  });
});
