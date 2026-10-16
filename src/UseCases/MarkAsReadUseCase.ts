import { Notification } from "../Domain/Entities/Notification.js";
import type { Principal } from "../Domain/Entities/Principal.js";
import { NotificationNotFoundError } from "../Domain/Errors/NotificationErrors.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export class MarkAsReadUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  /**
   * With an actor, only the actor's own notification can be marked; any
   * other one answers "not found". Without one (observe mode, ADR-0001),
   * the previous behaviour is kept.
   */
  public async execute(id: string, actor?: Principal): Promise<Notification> {
    const notification = await this.notificationRepo.findById(id);
    if (!notification || (actor && !notification.belongsTo(actor.userId))) {
      throw new NotificationNotFoundError(id);
    }

    notification.markAsRead();
    return this.notificationRepo.save(notification);
  }
}
