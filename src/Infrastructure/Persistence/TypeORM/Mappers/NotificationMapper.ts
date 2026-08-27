import { Notification } from "../../../../Domain/Entities/Notification.js";
import { NotificationEntity } from "../Entities/NotificationEntity.js";

export function toDomain(entity: NotificationEntity): Notification {
  return new Notification(
    entity.id,
    entity.recipientId,
    entity.actorId,
    entity.templateKey,
    entity.variables,
    entity.metadata,
    entity.isRead,
    entity.readAt,
    entity.createdAt,
    entity.deletedAt,
  );
}

export function toPersistence(domain: Notification): NotificationEntity {
  const entity = new NotificationEntity();
  entity.id = domain.id;
  entity.recipientId = domain.recipientId;
  entity.actorId = domain.actorId;
  entity.templateKey = domain.templateKey;
  entity.variables = domain.variables;
  entity.metadata = domain.metadata;
  entity.isRead = domain.isRead;
  entity.readAt = domain.readAt;
  entity.createdAt = domain.createdAt;
  entity.deletedAt = domain.deletedAt;
  return entity;
}
