import { UserPreferences } from "../../../../Domain/Entities/UserPreferences.js";
import { UserPreferencesEntity } from "../Entities/UserPreferencesEntity.js";

export function toDomain(entity: UserPreferencesEntity): UserPreferences {
  return new UserPreferences(
    entity.userId,
    entity.emailEnabled,
    entity.inAppEnabled,
    entity.mutedEventTypes || [],
  );
}

export function toPersistence(domain: UserPreferences): UserPreferencesEntity {
  const entity = new UserPreferencesEntity();
  entity.userId = domain.userId;
  entity.emailEnabled = domain.emailEnabled;
  entity.inAppEnabled = domain.inAppEnabled;
  entity.mutedEventTypes = domain.mutedEventTypes;
  return entity;
}
