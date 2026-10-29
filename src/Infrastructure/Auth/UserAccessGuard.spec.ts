import { HttpStatus, type INestApplication, Logger } from "@nestjs/common";
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
import { SendNotificationUseCase } from "../../UseCases/SendNotificationUseCase.js";
import { NotificationController } from "../Controllers/NotificationController.js";
import {
  ACCESS_CONTROL_MODE,
  ACCESS_CONTROL_MODE_TOKEN,
  type AccessControlMode,
} from "./AccessControlMode.js";
import { AccessTokenVerifier } from "./AccessTokenVerifier.js";
import { UserAccessGuard } from "./UserAccessGuard.js";

const inbox = { execute: vi.fn().mockResolvedValue({ data: [], total: 0 }) };
const send = { execute: vi.fn().mockResolvedValue({ sent: 1 }) };
const verifier = {
  verify: vi.fn(async (token: string | null | undefined) =>
    token === "valid-token" ? { userId: "user-42" } : null,
  ),
};

const createApp = async (mode: AccessControlMode) => {
  const stub = { execute: vi.fn(), get: vi.fn(), update: vi.fn() };
  const moduleRef = await Test.createTestingModule({
    controllers: [NotificationController],
    providers: [
      { provide: SendNotificationUseCase, useValue: send },
      { provide: GetInboxUseCase, useValue: inbox },
      { provide: MarkAsReadUseCase, useValue: stub },
      { provide: MarkAllAsReadUseCase, useValue: stub },
      { provide: EmptyTrashUseCase, useValue: stub },
      { provide: DeleteNotificationUseCase, useValue: stub },
      { provide: ManagePreferencesUseCase, useValue: stub },
      { provide: AccessTokenVerifier, useValue: verifier },
      { provide: ACCESS_CONTROL_MODE_TOKEN, useValue: mode },
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

  it("enforces access tokens now that clients send them", () => {
    expect(ACCESS_CONTROL_MODE).toBe("enforce");
  });

  describe("observe mode", () => {
    it("lets a request without token through and logs it", async () => {
      const warn = vi
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => {});
      app = await createApp("observe");

      await request(app.getHttpServer())
        .get("/notifications?recipientId=user-1")
        .expect(HttpStatus.OK);

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Observe mode: GET /notifications"),
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain("user-1");
    });

    it("does not log a request with a valid token", async () => {
      const warn = vi
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => {});
      app = await createApp("observe");

      await request(app.getHttpServer())
        .get("/notifications?recipientId=user-42")
        .set("Authorization", "Bearer valid-token")
        .expect(HttpStatus.OK);

      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("enforce mode", () => {
    it("refuses a request without token", async () => {
      app = await createApp("enforce");

      await request(app.getHttpServer())
        .get("/notifications?recipientId=user-1")
        .expect(HttpStatus.UNAUTHORIZED);
      expect(inbox.execute).not.toHaveBeenCalled();
    });

    it("refuses a forged token", async () => {
      app = await createApp("enforce");

      await request(app.getHttpServer())
        .get("/notifications")
        .set("Authorization", "Bearer forged-token")
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it("accepts a valid token", async () => {
      app = await createApp("enforce");

      await request(app.getHttpServer())
        .get("/notifications?recipientId=user-42")
        .set("Authorization", "Bearer valid-token")
        .expect(HttpStatus.OK);
    });

    it("keeps the internal route on the internal token only", async () => {
      vi.stubEnv("NOTIFICATION_INTERNAL_TOKEN", "internal");
      app = await createApp("enforce");

      await request(app.getHttpServer())
        .post("/notifications")
        .set("x-internal-token", "internal")
        .send({ recipients: { userIds: ["u"] }, templateKey: "welcome" })
        .expect(HttpStatus.CREATED);
    });
  });
});
