import { Notification } from "../../../../Domain/Entities/Notification.js";
import { NotificationEntity } from "../Entities/NotificationEntity.js";

export function toDomain(entity: NotificationEntity): Notification {
  return new Notification({
    id: entity.id,
    recipientId: entity.recipientId,
    actorId: entity.actorId,
    templateKey: entity.templateKey,
    variables: entity.variables,
    metadata: entity.metadata,
    read: entity.isRead,
    readTime: entity.readAt,
    createdAt: entity.createdAt,
    trashTime: entity.deletedAt,
    eventId: entity.eventId ?? null,
  });
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
  entity.eventId = domain.eventId;
  return entity;
}
