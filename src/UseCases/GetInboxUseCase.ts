import { Notification } from "../Domain/Entities/Notification.js";
import { requireRecipient } from "../Domain/Errors/NotificationErrors.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export interface GetInboxInput {
  // Refused when missing, as an absent query parameter gives undefined
  recipientId: string | undefined;
  page: number;
  limit: number;
  folder: "inbox" | "trash";
}

export class GetInboxUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  public async execute(input: GetInboxInput): Promise<Notification[]> {
    return await this.notificationRepo.findByRecipient(
      requireRecipient(input.recipientId),
      input.page,
      input.limit,
      input.folder,
    );
  }
}
