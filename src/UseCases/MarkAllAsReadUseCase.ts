import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export class MarkAllAsReadUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  public async execute(recipientId: string): Promise<void> {
    await this.notificationRepo.markAllAsRead(recipientId);
  }
}
