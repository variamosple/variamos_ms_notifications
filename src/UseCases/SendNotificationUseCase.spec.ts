import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";
import { NotificationTemplate } from "../Domain/Entities/NotificationTemplate.js";
import { UserPreferences } from "../Domain/Entities/UserPreferences.js";
import { TemplateNotConfiguredError } from "../Domain/Errors/NotificationErrors.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import { INotificationTemplateRepository } from "../Domain/Repositories/INotificationTemplateRepository.js";
import { IUserPreferencesRepository } from "../Domain/Repositories/IUserPreferencesRepository.js";
import { INotificationChannel } from "../Domain/Services/INotificationChannel.js";
import { IUserService } from "../Domain/Services/IUserService.js";
import {
  DISPATCH_BATCH_SIZE,
  SendNotificationUseCase,
} from "./SendNotificationUseCase.js";

describe("SendNotificationUseCase", () => {
  let notificationRepo: MockProxy<INotificationRepository>;
  let preferencesRepo: MockProxy<IUserPreferencesRepository>;
  let templateRepo: MockProxy<INotificationTemplateRepository>;
  let userService: MockProxy<IUserService>;
  let notificationChannel: MockProxy<INotificationChannel>;
  let useCase: SendNotificationUseCase;

  beforeEach(() => {
    notificationRepo = mock<INotificationRepository>();
    preferencesRepo = mock<IUserPreferencesRepository>();
    templateRepo = mock<INotificationTemplateRepository>();
    userService = mock<IUserService>();
    notificationChannel = mock<INotificationChannel>();

    useCase = new SendNotificationUseCase(
      notificationRepo,
      preferencesRepo,
      templateRepo,
      userService,
      notificationChannel,
    );
  });

  it("should throw an error if the template key is not found", async () => {
    templateRepo.findByKey.mockResolvedValue(null);

    await expect(
      useCase.execute({
        recipients: { userIds: ["user-1"] },
        templateKey: "invalid_key",
        variables: {},
        metadata: {},
      }),
    ).rejects.toBeInstanceOf(TemplateNotConfiguredError);
  });

  it("should create, save and send notifications to specific userIds", async () => {
    const template = new NotificationTemplate(
      "review_assigned",
      "New review",
      "Hello {{name}}",
      new Date(),
    );
    templateRepo.findByKey.mockResolvedValue(template);

    // Mock preferences to be enabled
    preferencesRepo.findByUserIds.mockImplementation(async (userIds) =>
      userIds.map((userId) => new UserPreferences(userId, true, true, [])),
    );

    notificationRepo.saveMany.mockImplementation(async (batch) => batch);

    const result = await useCase.execute({
      recipients: { userIds: ["user-1", "user-2"] },
      templateKey: "review_assigned",
      variables: { name: "Tester" },
      metadata: { refId: 10 },
    });

    expect(result).toHaveLength(2);
    expect(result[0].recipientId).toBe("user-1");
    expect(result[1].recipientId).toBe("user-2");
    expect(result[0].variables).toEqual({ name: "Tester" });
    expect(result[0].isRead).toBe(false);
    expect(notificationRepo.saveMany).toHaveBeenCalledTimes(1);
    expect(notificationChannel.send).toHaveBeenCalledTimes(2);
  });

  it("should resolve roles and send notifications to role members", async () => {
    const template = new NotificationTemplate(
      "system_announcement",
      "System alert",
      "Notice",
      new Date(),
    );
    templateRepo.findByKey.mockResolvedValue(template);
    userService.findUserIdsByRoles.mockResolvedValue(["admin-1", "admin-2"]);
    preferencesRepo.findByUserIds.mockImplementation(async (userIds) =>
      userIds.map((userId) => new UserPreferences(userId, true, true, [])),
    );
    notificationRepo.saveMany.mockImplementation(async (batch) => batch);

    const result = await useCase.execute({
      recipients: { roles: ["administrator"] },
      templateKey: "system_announcement",
      variables: {},
      metadata: {},
    });

    expect(userService.findUserIdsByRoles).toHaveBeenCalledWith([
      "administrator",
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].recipientId).toBe("admin-1");
    expect(result[1].recipientId).toBe("admin-2");
  });

  it("should not query user service if roles list is empty", async () => {
    const template = new NotificationTemplate(
      "system_announcement",
      "System alert",
      "Notice",
      new Date(),
    );
    templateRepo.findByKey.mockResolvedValue(template);

    const result = await useCase.execute({
      recipients: { roles: [] },
      templateKey: "system_announcement",
      variables: {},
      metadata: {},
    });

    expect(result).toHaveLength(0);
    expect(userService.findUserIdsByRoles).not.toHaveBeenCalled();
  });

  it("should skip recipient if the eventType is muted in user preferences", async () => {
    const template = new NotificationTemplate(
      "review_assigned",
      "New review",
      "Assignee info",
      new Date(),
    );
    templateRepo.findByKey.mockResolvedValue(template);

    // user-1 has muted "review_assigned", user-2 has not
    preferencesRepo.findByUserIds.mockResolvedValue([
      new UserPreferences("user-1", true, true, ["review_assigned"]),
      new UserPreferences("user-2", true, true, []),
    ]);

    notificationRepo.saveMany.mockImplementation(async (batch) => batch);

    const result = await useCase.execute({
      recipients: { userIds: ["user-1", "user-2"] },
      templateKey: "review_assigned",
      variables: {},
      metadata: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0].recipientId).toBe("user-2");
    expect(notificationRepo.saveMany.mock.calls[0][0]).toHaveLength(1);
    expect(notificationChannel.send).toHaveBeenCalledTimes(1);
  });

  it("should use default preferences if user preferences are not found in database", async () => {
    const template = new NotificationTemplate(
      "review_assigned",
      "New review",
      "Info",
      new Date(),
    );
    templateRepo.findByKey.mockResolvedValue(template);

    // No preferences saved for this user
    preferencesRepo.findByUserIds.mockResolvedValue([]);
    notificationRepo.saveMany.mockImplementation(async (batch) => batch);

    const result = await useCase.execute({
      recipients: { userIds: ["user-new"] },
      templateKey: "review_assigned",
      variables: {},
      metadata: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0].recipientId).toBe("user-new");
    expect(result[0].isRead).toBe(false);
    // Verify that it still gets sent via websocket channel (default inAppEnabled is true)
    expect(notificationChannel.send).toHaveBeenCalledTimes(1);
  });

  it("should save notification but not send it via websocket if inAppEnabled is false", async () => {
    const template = new NotificationTemplate(
      "review_assigned",
      "New review",
      "Info",
      new Date(),
    );
    templateRepo.findByKey.mockResolvedValue(template);

    preferencesRepo.findByUserIds.mockResolvedValue([
      new UserPreferences("user-1", true, false, []),
    ]);
    notificationRepo.saveMany.mockImplementation(async (batch) => batch);

    const result = await useCase.execute({
      recipients: { userIds: ["user-1"] },
      templateKey: "review_assigned",
      variables: {},
      metadata: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0].recipientId).toBe("user-1");
    expect(notificationRepo.saveMany.mock.calls[0][0]).toHaveLength(1);
    expect(notificationChannel.send).not.toHaveBeenCalled();
  });

  describe("dispatch by batch (EV-101, OPT-04)", () => {
    const recipients = (count: number) =>
      Array.from({ length: count }, (_, i) => `user-${i}`);

    beforeEach(() => {
      templateRepo.findByKey.mockResolvedValue(
        new NotificationTemplate("broadcast", "News", "Body", new Date()),
      );
      preferencesRepo.findByUserIds.mockResolvedValue([]);
      notificationRepo.saveMany.mockImplementation(async (batch) => batch);
    });

    it.each([
      [200, 1],
      [1201, 3],
    ])(
      "reads the preferences and saves %i notifications in %i round trips each",
      async (count, roundTrips) => {
        const result = await useCase.execute({
          recipients: { userIds: recipients(count) },
          templateKey: "broadcast",
          variables: {},
          metadata: {},
        });

        expect(result).toHaveLength(count);
        expect(preferencesRepo.findByUserIds).toHaveBeenCalledTimes(roundTrips);
        expect(notificationRepo.saveMany).toHaveBeenCalledTimes(roundTrips);
        expect(
          notificationRepo.saveMany.mock.calls.map(([batch]) => batch.length),
        ).toEqual(
          Array.from({ length: roundTrips }, (_, i) =>
            Math.min(DISPATCH_BATCH_SIZE, count - i * DISPATCH_BATCH_SIZE),
          ),
        );
        expect(notificationChannel.send).toHaveBeenCalledTimes(count);
      },
    );

    it("sends only what was saved, and stops at a failed batch", async () => {
      const events: string[] = [];
      notificationRepo.saveMany
        .mockImplementationOnce(async (batch) => {
          events.push(`saved ${batch.length}`);
          return batch;
        })
        .mockRejectedValueOnce(new Error("database down"));
      notificationChannel.send.mockImplementation(async () => {
        events.push("sent");
      });

      await expect(
        useCase.execute({
          recipients: { userIds: recipients(DISPATCH_BATCH_SIZE + 10) },
          templateKey: "broadcast",
          variables: {},
          metadata: {},
        }),
      ).rejects.toThrow("database down");

      expect(events[0]).toBe(`saved ${DISPATCH_BATCH_SIZE}`);
      expect(events.filter((e) => e === "sent")).toHaveLength(
        DISPATCH_BATCH_SIZE,
      );
    });
  });
});
