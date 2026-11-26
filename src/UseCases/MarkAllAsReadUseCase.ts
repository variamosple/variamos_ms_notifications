import { requireRecipient } from "../Domain/Errors/NotificationErrors.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export class MarkAllAsReadUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  // The user of the access token; an empty one is still refused (CA-NT-01)
  public async execute(recipientId: string): Promise<void> {
    await this.notificationRepo.markAllAsRead(requireRecipient(recipientId));
  }
}
