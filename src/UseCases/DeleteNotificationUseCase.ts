import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export class DeleteNotificationUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  public async execute(id: string): Promise<void> {
    const notification = await this.notificationRepo.findById(id);
    if (!notification) {
      throw new Error(`Notification with ID '${id}' not found`);
    }
    await this.notificationRepo.delete(id);
  }
}
