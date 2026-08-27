import { randomUUID } from "node:crypto";
import { JsonValue } from "../Domain/Entities/JsonValue.js";
import { Notification } from "../Domain/Entities/Notification.js";
import { UserPreferences } from "../Domain/Entities/UserPreferences.js";
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
      throw new Error(`Template with key '${input.templateKey}' not found`);
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

    const createdNotifications: Notification[] = [];

    // 3. Process dispatch for each recipient
    for (const recipientId of recipientIds) {
      // Fetch user preferences
      let preferences = await this.preferencesRepo.findByUserId(recipientId);

      if (!preferences) {
        // Default preferences if not configured
        preferences = new UserPreferences(recipientId, true, true, []);
      }

      // Check if user has muted this eventType
      if (preferences.isMuted(input.templateKey)) {
        continue;
      }

      // Generate the notification
      const notification = new Notification(
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
      );

      // Save notification to database
      const savedNotification = await this.notificationRepo.save(notification);

      // Send to active channels (WebSocket, email, etc.)
      if (preferences.inAppEnabled) {
        await this.notificationChannel.send(savedNotification);
      }

      createdNotifications.push(savedNotification);
    }

    return createdNotifications;
  }
}
