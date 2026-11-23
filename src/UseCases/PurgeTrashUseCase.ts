import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

/** How long a notification stays in the trash before it is deleted. */
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes the notifications that have been in the trash for more than
 * TRASH_RETENTION_DAYS, for every user: the trash was never emptied unless
 * its user did it (ADM-N16). Returns how many were deleted.
 */
export class PurgeTrashUseCase {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public execute(): Promise<number> {
    const cutoff = new Date(
      this.now().getTime() - TRASH_RETENTION_DAYS * DAY_MS,
    );
    return this.notificationRepo.purgeTrashedBefore(cutoff);
  }
}
