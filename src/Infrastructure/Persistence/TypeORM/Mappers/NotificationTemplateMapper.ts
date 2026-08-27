import { NotificationTemplate } from "../../../../Domain/Entities/NotificationTemplate.js";
import { NotificationTemplateEntity } from "../Entities/NotificationTemplateEntity.js";

export function toDomain(
  entity: NotificationTemplateEntity,
): NotificationTemplate {
  return new NotificationTemplate(
    entity.key,
    entity.titleTemplate,
    entity.bodyTemplate,
    entity.createdAt,
  );
}

export function toPersistence(
  domain: NotificationTemplate,
): NotificationTemplateEntity {
  const entity = new NotificationTemplateEntity();
  entity.key = domain.key;
  entity.titleTemplate = domain.titleTemplate;
  entity.bodyTemplate = domain.bodyTemplate;
  entity.createdAt = domain.createdAt;
  return entity;
}
