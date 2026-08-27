import { NotificationTemplate } from "../Entities/NotificationTemplate.js";

export interface INotificationTemplateRepository {
  findByKey(key: string): Promise<NotificationTemplate | null>;
  save(template: NotificationTemplate): Promise<NotificationTemplate>;
}
