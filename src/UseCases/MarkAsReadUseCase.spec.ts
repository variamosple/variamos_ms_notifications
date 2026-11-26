import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";
import { Notification } from "../Domain/Entities/Notification.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import { MarkAsReadUseCase } from "./MarkAsReadUseCase.js";

const owner = { userId: "user-1" };

describe("MarkAsReadUseCase", () => {
  let notificationRepo: MockProxy<INotificationRepository>;
  let useCase: MarkAsReadUseCase;

  beforeEach(() => {
    notificationRepo = mock<INotificationRepository>();
    useCase = new MarkAsReadUseCase(notificationRepo);
  });

  it("should throw an error if notification is not found", async () => {
    notificationRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute("non-existent-id", owner)).rejects.toThrow(
      "Notification with ID 'non-existent-id' not found",
    );
  });

  it("should mark notification as read and save it", async () => {
    const notif = new Notification({
      id: "id-1",
      recipientId: "user-1",
      actorId: null,
      templateKey: "key-1",
      variables: {},
      metadata: {},
      read: false,
      readTime: null,
      createdAt: new Date(),
    });

    notificationRepo.findById.mockResolvedValue(notif);
    notificationRepo.save.mockImplementation(async (n) => n);

    const result = await useCase.execute("id-1", owner);

    expect(result.isRead).toBe(true);
    expect(result.readAt).toBeInstanceOf(Date);
    expect(notificationRepo.save).toHaveBeenCalledWith(notif);
  });

  it("answers not found for the notification of another user", async () => {
    const notif = new Notification({
      id: "id-1",
      recipientId: "user-1",
      actorId: null,
      templateKey: "key-1",
      variables: {},
      metadata: {},
      read: false,
      readTime: null,
      createdAt: new Date(),
    });
    notificationRepo.findById.mockResolvedValue(notif);

    await expect(useCase.execute("id-1", { userId: "user-2" })).rejects.toThrow(
      "Notification with ID 'id-1' not found",
    );
    expect(notificationRepo.save).not.toHaveBeenCalled();
    expect(notif.isRead).toBe(false);
  });
});
