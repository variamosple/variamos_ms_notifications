import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";
import { NotificationTemplate } from "../Domain/Entities/NotificationTemplate.js";
import { UserPreferences } from "../Domain/Entities/UserPreferences.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import { INotificationTemplateRepository } from "../Domain/Repositories/INotificationTemplateRepository.js";
import { IUserPreferencesRepository } from "../Domain/Repositories/IUserPreferencesRepository.js";
import { INotificationChannel } from "../Domain/Services/INotificationChannel.js";
import { IUserService } from "../Domain/Services/IUserService.js";
import { SendNotificationUseCase } from "./SendNotificationUseCase.js";

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
    ).rejects.toThrow("Template with key 'invalid_key' not found");
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
    preferencesRepo.findByUserId.mockImplementation(async (userId) => {
      return new UserPreferences(userId, true, true, []);
    });

    notificationRepo.save.mockImplementation(async (notif) => notif);

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
    expect(notificationRepo.save).toHaveBeenCalledTimes(2);
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
    preferencesRepo.findByUserId.mockImplementation(async (userId) => {
      return new UserPreferences(userId, true, true, []);
    });
    notificationRepo.save.mockImplementation(async (notif) => notif);

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
    preferencesRepo.findByUserId.mockImplementation(async (userId) => {
      if (userId === "user-1") {
        return new UserPreferences(userId, true, true, ["review_assigned"]);
      }
      return new UserPreferences(userId, true, true, []);
    });

    notificationRepo.save.mockImplementation(async (notif) => notif);

    const result = await useCase.execute({
      recipients: { userIds: ["user-1", "user-2"] },
      templateKey: "review_assigned",
      variables: {},
      metadata: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0].recipientId).toBe("user-2");
    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
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

    // Mock findByUserId to return null (not found)
    preferencesRepo.findByUserId.mockResolvedValue(null);
    notificationRepo.save.mockImplementation(async (notif) => notif);

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

    preferencesRepo.findByUserId.mockResolvedValue(
      new UserPreferences("user-1", true, false, []),
    );
    notificationRepo.save.mockImplementation(async (notif) => notif);

    const result = await useCase.execute({
      recipients: { userIds: ["user-1"] },
      templateKey: "review_assigned",
      variables: {},
      metadata: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0].recipientId).toBe("user-1");
    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    expect(notificationChannel.send).not.toHaveBeenCalled();
  });
});
