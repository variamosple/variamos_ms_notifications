import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import {
  PurgeTrashUseCase,
  TRASH_RETENTION_DAYS,
} from "./PurgeTrashUseCase.js";

describe("PurgeTrashUseCase", () => {
  it("deletes what has been in the trash for more than 30 days", async () => {
    const notificationRepo = mock<INotificationRepository>();
    notificationRepo.purgeTrashedBefore.mockResolvedValue(4);
    const useCase = new PurgeTrashUseCase(
      notificationRepo,
      () => new Date("2026-11-23T12:00:00Z"),
    );

    const deleted = await useCase.execute();

    expect(TRASH_RETENTION_DAYS).toBe(30);
    expect(notificationRepo.purgeTrashedBefore).toHaveBeenCalledWith(
      new Date("2026-10-24T12:00:00Z"),
    );
    expect(deleted).toBe(4);
  });
});
