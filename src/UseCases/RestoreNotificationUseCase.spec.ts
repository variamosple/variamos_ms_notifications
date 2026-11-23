import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";
import { Notification } from "../Domain/Entities/Notification.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import { RestoreNotificationUseCase } from "./RestoreNotificationUseCase.js";

const trashed = () =>
  new Notification({
    id: "id-1",
    recipientId: "user-1",
    actorId: null,
    templateKey: "key-1",
    variables: {},
    metadata: {},
    read: false,
    readTime: null,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    trashTime: new Date("2026-11-02T10:00:00Z"),
  });

describe("RestoreNotificationUseCase", () => {
  let notificationRepo: MockProxy<INotificationRepository>;
  let useCase: RestoreNotificationUseCase;

  beforeEach(() => {
    notificationRepo = mock<INotificationRepository>();
    notificationRepo.save.mockImplementation(async (n) => n);
    useCase = new RestoreNotificationUseCase(notificationRepo);
  });

  it("takes the notification out of the trash and saves it", async () => {
    notificationRepo.findById.mockResolvedValue(trashed());

    const restored = await useCase.execute("id-1", { userId: "user-1" });

    expect(restored.deletedAt).toBeNull();
    expect(notificationRepo.save).toHaveBeenCalledWith(restored);
  });

  it("answers not found for the notification of another user", async () => {
    notificationRepo.findById.mockResolvedValue(trashed());

    await expect(useCase.execute("id-1", { userId: "user-2" })).rejects.toThrow(
      "Notification with ID 'id-1' not found",
    );
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it("answers not found for a notification that does not exist", async () => {
    notificationRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute("missing")).rejects.toThrow(
      "Notification with ID 'missing' not found",
    );
  });
});
