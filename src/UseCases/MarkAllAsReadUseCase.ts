import { requireRecipient } from "../Domain/Errors/NotificationErrors.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export class MarkAllAsReadUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  public async execute(recipientId: string | undefined): Promise<void> {
    await this.notificationRepo.markAllAsRead(requireRecipient(recipientId));
  }
}
