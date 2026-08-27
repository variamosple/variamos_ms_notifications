import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import { MarkAllAsReadUseCase } from "./MarkAllAsReadUseCase.js";

describe("MarkAllAsReadUseCase", () => {
  let notificationRepo: MockProxy<INotificationRepository>;
  let useCase: MarkAllAsReadUseCase;

  beforeEach(() => {
    notificationRepo = mock<INotificationRepository>();
    useCase = new MarkAllAsReadUseCase(notificationRepo);
  });

  it("should trigger markAllAsRead in repository", async () => {
    await useCase.execute("user-1");
    expect(notificationRepo.markAllAsRead).toHaveBeenCalledWith("user-1");
  });
});
