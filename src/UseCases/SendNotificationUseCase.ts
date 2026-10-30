import { randomUUID } from "node:crypto";
import { JsonValue } from "../Domain/Entities/JsonValue.js";
import { Notification } from "../Domain/Entities/Notification.js";
import { UserPreferences } from "../Domain/Entities/UserPreferences.js";
import { TemplateNotConfiguredError } from "../Domain/Errors/NotificationErrors.js";
import { INotificationRepository } from "../Domain/Repositories/INotificationRepository.js";
import { INotificationTemplateRepository } from "../Domain/Repositories/INotificationTemplateRepository.js";
import { IUserPreferencesRepository } from "../Domain/Repositories/IUserPreferencesRepository.js";
import { INotificationChannel } from "../Domain/Services/INotificationChannel.js";
import { IUserService } from "../Domain/Services/IUserService.js";

export interface SendNotificationInput {
  recipients: {
    userIds?: string[];
    roles?: string[];
  };
  templateKey: string;
  variables: Record<string, JsonValue>;
  metadata: Record<string, JsonValue>;
  actorId?: string | null;
}

// Recipients read and notifications inserted per database round trip
export const DISPATCH_BATCH_SIZE = 500;

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

export class SendNotificationUseCase {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly preferencesRepo: IUserPreferencesRepository,
    private readonly templateRepo: INotificationTemplateRepository,
    private readonly userService: IUserService,
    private readonly notificationChannel: INotificationChannel,
  ) {}

  public async execute(input: SendNotificationInput): Promise<Notification[]> {
    // 1. Retrieve the notification template
    const template = await this.templateRepo.findByKey(input.templateKey);
    if (!template) {
      throw new TemplateNotConfiguredError(input.templateKey);
    }

    // 2. Resolve recipient user IDs (userIds)
    let recipientIds: string[] = [];

    if (input.recipients.userIds) {
      recipientIds = [...input.recipients.userIds];
    }

    if (input.recipients.roles && input.recipients.roles.length > 0) {
      const roleUserIds = await this.userService.findUserIdsByRoles(
        input.recipients.roles,
      );
      recipientIds = [...recipientIds, ...roleUserIds];
    }

    // Deduplicate IDs
    recipientIds = Array.from(new Set(recipientIds));

    // 3. Read the preferences of all recipients at once; a user without
    // saved preferences gets the defaults
    const preferencesByUser = new Map<string, UserPreferences>();
    for (const ids of chunks(recipientIds, DISPATCH_BATCH_SIZE)) {
      for (const preferences of await this.preferencesRepo.findByUserIds(ids)) {
        preferencesByUser.set(preferences.userId, preferences);
      }
    }
    const preferencesOf = (recipientId: string) =>
      preferencesByUser.get(recipientId) ??
      UserPreferences.defaultsFor(recipientId);

    // 4. One notification per recipient who has not muted this event type
    const notifications = recipientIds
      .filter(
        (recipientId) => !preferencesOf(recipientId).isMuted(input.templateKey),
      )
      .map(
        (recipientId) =>
          new Notification(
            randomUUID(),
            recipientId,
            input.actorId || null,
            input.templateKey,
            input.variables,
            input.metadata,
            false, // isRead
            null, // readAt
            new Date(), // createdAt
            null, // deletedAt
          ),
      );

    // 5. Save by batch, then send each saved batch to the active channels
    // (WebSocket): a notification is never sent before it is saved. A failed
    // batch stops the dispatch; the batches before it stay saved and sent.
    const createdNotifications: Notification[] = [];
    for (const batch of chunks(notifications, DISPATCH_BATCH_SIZE)) {
      const saved = await this.notificationRepo.saveMany(batch);
      for (const notification of saved) {
        if (preferencesOf(notification.recipientId).inAppEnabled) {
          await this.notificationChannel.send(notification);
        }
      }
      createdNotifications.push(...saved);
    }

    return createdNotifications;
  }
}
