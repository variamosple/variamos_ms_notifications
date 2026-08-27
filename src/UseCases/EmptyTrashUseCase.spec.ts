import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import { EmptyTrashUseCase } from "./EmptyTrashUseCase.js";

describe("EmptyTrashUseCase", () => {
  let notificationRepo: MockProxy<INotificationRepository>;
  let useCase: EmptyTrashUseCase;

  beforeEach(() => {
    notificationRepo = mock<INotificationRepository>();
    useCase = new EmptyTrashUseCase(notificationRepo);
  });

  it("should trigger emptyTrash in repository", async () => {
    await useCase.execute("user-1");
    expect(notificationRepo.emptyTrash).toHaveBeenCalledWith("user-1");
  });
});
