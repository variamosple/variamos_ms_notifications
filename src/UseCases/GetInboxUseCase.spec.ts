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
      new Notification({
        id: "1",
        recipientId: "user-1",
        actorId: null,
        templateKey: "k",
        variables: {},
        metadata: {},
        read: false,
        readTime: null,
        createdAt: new Date(),
      }),
      new Notification({
        id: "2",
        recipientId: "user-1",
        actorId: null,
        templateKey: "k",
        variables: {},
        metadata: {},
        read: false,
        readTime: null,
        createdAt: new Date(),
      }),
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
