import type { Principal } from "../Domain/Entities/Principal.js";
import { NotificationNotFoundError } from "../Domain/Errors/NotificationErrors.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export class DeleteNotificationUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  /**
   * With an actor, only the actor's own notification can be deleted; any
   * other one answers "not found".
   */
  public async execute(id: string, actor?: Principal): Promise<void> {
    const notification = await this.notificationRepo.findById(id);
    if (!notification || (actor && !notification.belongsTo(actor.userId))) {
      throw new NotificationNotFoundError(id);
    }
    await this.notificationRepo.delete(id);
  }
}
