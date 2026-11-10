import { Notification } from "../Entities/Notification.js";

export interface INotificationRepository {
  save(notification: Notification): Promise<Notification>;
  // New notifications only, saved together: all or none
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
}
