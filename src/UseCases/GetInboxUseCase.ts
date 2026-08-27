import { Notification } from "../Domain/Entities/Notification.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";

export interface GetInboxInput {
  recipientId: string;
  page: number;
  limit: number;
  folder: "inbox" | "trash";
}

export class GetInboxUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  public async execute(input: GetInboxInput): Promise<Notification[]> {
    return this.notificationRepo.findByRecipient(
      input.recipientId,
      input.page,
      input.limit,
      input.folder,
    );
  }
}
