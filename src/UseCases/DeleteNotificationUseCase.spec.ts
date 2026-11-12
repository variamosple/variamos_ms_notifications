import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";
import { Notification } from "../Domain/Entities/Notification.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import { DeleteNotificationUseCase } from "./DeleteNotificationUseCase.js";

describe("DeleteNotificationUseCase", () => {
  let notificationRepo: MockProxy<INotificationRepository>;
  let useCase: DeleteNotificationUseCase;

  beforeEach(() => {
    notificationRepo = mock<INotificationRepository>();
    useCase = new DeleteNotificationUseCase(notificationRepo);
  });

  it("should throw an error if notification is not found", async () => {
    notificationRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute("non-existent-id")).rejects.toThrow(
      "Notification with ID 'non-existent-id' not found",
    );
  });

  it("moves the notification to the trash and saves it", async () => {
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

    await useCase.execute("id-1");

    expect(notificationRepo.save).toHaveBeenCalledWith(notif);
    expect(notif.deletedAt).toBeInstanceOf(Date);
  });
});
