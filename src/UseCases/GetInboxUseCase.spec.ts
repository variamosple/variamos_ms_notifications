import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";
import { Notification } from "../Domain/Entities/Notification.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import { GetInboxUseCase } from "./GetInboxUseCase.js";

describe("GetInboxUseCase", () => {
  let notificationRepo: MockProxy<INotificationRepository>;
  let useCase: GetInboxUseCase;

  beforeEach(() => {
    notificationRepo = mock<INotificationRepository>();
    useCase = new GetInboxUseCase(notificationRepo);
  });

  it("should retrieve notifications for recipient in the specified folder", async () => {
    const notifications = [
      new Notification(
        "1",
        "user-1",
        null,
        "k",
        {},
        {},
        false,
        null,
        new Date(),
      ),
      new Notification(
        "2",
        "user-1",
        null,
        "k",
        {},
        {},
        false,
        null,
        new Date(),
      ),
    ];

    notificationRepo.findByRecipient.mockResolvedValue(notifications);

    const result = await useCase.execute({
      recipientId: "user-1",
      page: 1,
      limit: 10,
      folder: "inbox",
    });

    expect(result).toHaveLength(2);
    expect(notificationRepo.findByRecipient).toHaveBeenCalledWith(
      "user-1",
      1,
      10,
      "inbox",
    );
  });
});
