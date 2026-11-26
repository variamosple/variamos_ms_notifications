import type { Notification } from "../Domain/Entities/Notification.js";
import type { Principal } from "../Domain/Entities/Principal.js";
import { NotificationNotFoundError } from "../Domain/Errors/NotificationErrors.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

/** Takes a notification out of the trash, back to the inbox (ADM-N16). */
export class RestoreNotificationUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  /**
   * Only the actor's own notification can be restored; any other one
   * answers "not found", so that its existence is not told.
   */
  public async execute(id: string, actor: Principal): Promise<Notification> {
    const notification = await this.notificationRepo.findById(id);
    if (!notification?.belongsTo(actor.userId)) {
      throw new NotificationNotFoundError(id);
    }
    notification.restoreFromTrash();
    return this.notificationRepo.save(notification);
  }
}
