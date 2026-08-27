import { Notification } from "../Domain/Entities/Notification.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export class MarkAsReadUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  public async execute(id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findById(id);
    if (!notification) {
      throw new Error(`Notification with ID '${id}' not found`);
    }

    notification.markAsRead();
    return this.notificationRepo.save(notification);
  }
}
