import { HttpStatus, type INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteNotificationUseCase } from "../../UseCases/DeleteNotificationUseCase.js";
import { EmptyTrashUseCase } from "../../UseCases/EmptyTrashUseCase.js";
import { GetInboxUseCase } from "../../UseCases/GetInboxUseCase.js";
import { ManagePreferencesUseCase } from "../../UseCases/ManagePreferencesUseCase.js";
import { MarkAllAsReadUseCase } from "../../UseCases/MarkAllAsReadUseCase.js";
import { MarkAsReadUseCase } from "../../UseCases/MarkAsReadUseCase.js";
import { RestoreNotificationUseCase } from "../../UseCases/RestoreNotificationUseCase.js";
import { SendNotificationUseCase } from "../../UseCases/SendNotificationUseCase.js";
import { NOTIFICATION_CONTROLLERS } from "../Controllers/notificationControllers.js";
import { AccessTokenVerifier } from "./AccessTokenVerifier.js";
import { UserAccessGuard } from "./UserAccessGuard.js";

const inbox = { execute: vi.fn().mockResolvedValue([]) };
const send = { execute: vi.fn().mockResolvedValue([]) };
const verifier = {
  verify: vi.fn(async (token: string | null | undefined) =>
    token === "valid-token" ? { userId: "user-42" } : null,
  ),
};

const createApp = async () => {
  const stub = { execute: vi.fn(), get: vi.fn(), update: vi.fn() };
  const moduleRef = await Test.createTestingModule({
    controllers: NOTIFICATION_CONTROLLERS,
    providers: [
      { provide: SendNotificationUseCase, useValue: send },
      { provide: GetInboxUseCase, useValue: inbox },
      { provide: MarkAsReadUseCase, useValue: stub },
      { provide: MarkAllAsReadUseCase, useValue: stub },
      { provide: EmptyTrashUseCase, useValue: stub },
      { provide: DeleteNotificationUseCase, useValue: stub },
      { provide: RestoreNotificationUseCase, useValue: stub },
      { provide: ManagePreferencesUseCase, useValue: stub },
      { provide: AccessTokenVerifier, useValue: verifier },
      { provide: APP_GUARD, useClass: UserAccessGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
};

describe("UserAccessGuard", () => {
  let app: INestApplication;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  it("refuses a request without token, even when it names a recipient", async () => {
    app = await createApp();

    for (const query of ["", "?recipientId=user-1", "?userId=user-1"]) {
      await request(app.getHttpServer())
        .get(`/notifications${query}`)
        .expect(HttpStatus.UNAUTHORIZED);
    }
    expect(inbox.execute).not.toHaveBeenCalled();
  });

  it("refuses a forged token", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get("/notifications")
      .set("Authorization", "Bearer forged-token");
    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("accepts a valid token, and reads the inbox of its user only", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer())
      .get("/notifications?recipientId=user-1")
      .set("Authorization", "Bearer valid-token");
    expect(response.status).toBe(HttpStatus.OK);
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "user-42" }),
    );
  });

  it("keeps the internal route on the internal token only", async () => {
    vi.stubEnv("NOTIFICATION_INTERNAL_TOKEN", "internal");
    app = await createApp();

    const response = await request(app.getHttpServer())
      .post("/notifications")
      .set("x-internal-token", "internal")
      .send({ recipients: { userIds: ["u"] }, templateKey: "welcome" });
    expect(response.status).toBe(HttpStatus.CREATED);
  });
});
