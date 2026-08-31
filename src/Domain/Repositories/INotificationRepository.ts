import { Notification } from "../Entities/Notification.js";

export interface INotificationRepository {
  save(notification: Notification): Promise<Notification>;
  saveMany(notifications: Notification[]): Promise<Notification[]>;
  findById(id: string): Promise<Notification | null>;
  findByRecipient(
    recipientId: string,
    page: number,
    limit: number,
    folder: "inbox" | "trash",
  ): Promise<Notification[]>;
  countUnread(recipientId: string): Promise<number>;
  markAllAsRead(recipientId: string): Promise<void>;
  emptyTrash(recipientId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
