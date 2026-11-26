import type { Principal } from "../Domain/Entities/Principal.js";
import { NotificationNotFoundError } from "../Domain/Errors/NotificationErrors.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export class DeleteNotificationUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  /**
   * Only the actor's own notification can be deleted; any other one answers
   * "not found", so that its existence is not told.
   */
  public async execute(id: string, actor: Principal): Promise<void> {
    const notification = await this.notificationRepo.findById(id);
    if (!notification?.belongsTo(actor.userId)) {
      throw new NotificationNotFoundError(id);
    }
    notification.moveToTrash();
    await this.notificationRepo.save(notification);
  }
}
