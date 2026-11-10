import type { JsonValue } from "../../Domain/Entities/JsonValue.js";
import type { Notification } from "../../Domain/Entities/Notification.js";
import type { UserPreferences } from "../../Domain/Entities/UserPreferences.js";

// HTTP answers of the service, written out field by field: a change of the
// entities does not change what the clients receive.
export interface NotificationResponse {
  id: string;
  recipientId: string;
  actorId: string | null;
  templateKey: string;
  variables: Record<string, JsonValue>;
  metadata: Record<string, JsonValue>;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface PreferencesResponse {
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  mutedEventTypes: string[];
}

export const toNotificationResponse = (
  notification: Notification,
): NotificationResponse => ({
  id: notification.id,
  recipientId: notification.recipientId,
  actorId: notification.actorId,
  templateKey: notification.templateKey,
  variables: notification.variables,
  metadata: notification.metadata,
  isRead: notification.isRead,
  readAt: notification.readAt,
  createdAt: notification.createdAt,
  deletedAt: notification.deletedAt,
});

export const toPreferencesResponse = (
  preferences: UserPreferences,
): PreferencesResponse => ({
  userId: preferences.userId,
  emailEnabled: preferences.emailEnabled,
  inAppEnabled: preferences.inAppEnabled,
  mutedEventTypes: [...preferences.mutedEventTypes],
});
