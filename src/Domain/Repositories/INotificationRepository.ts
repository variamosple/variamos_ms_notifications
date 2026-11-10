import { Notification } from "../Entities/Notification.js";

export interface INotificationRepository {
  save(notification: Notification): Promise<Notification>;
  // New notifications only, saved together: all or none. A notification
  // whose send key its recipient already holds is left out; the result
  // holds only those saved (EV-99).
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
