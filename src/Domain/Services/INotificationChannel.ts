import { Notification } from "../Entities/Notification.js";

export interface INotificationChannel {
  send(notification: Notification): Promise<void>;
}
