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
  // Delivered whatever the recipient muted: a security alert (EV-99)
  mandatory?: boolean;
  // Key of the send, chosen by its sender: sent again with the same key,
  // it gives nothing twice to a recipient (EV-99, CA-NT-05)
  eventId?: string | null;
}

// Recipients read and notifications inserted per database round trip
export const DISPATCH_BATCH_SIZE = 500;

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

/** The stores a send reads and writes. */
export interface SendNotificationStores {
  notificationRepo: INotificationRepository;
  preferencesRepo: IUserPreferencesRepository;
  templateRepo: INotificationTemplateRepository;
}

/** Everything a send uses: its stores, the user service and the channel. */
export interface SendNotificationDependencies extends SendNotificationStores {
  userService: IUserService;
  notificationChannel: INotificationChannel;
}

export class SendNotificationUseCase {
  private readonly notificationRepo: INotificationRepository;
  private readonly preferencesRepo: IUserPreferencesRepository;
  private readonly templateRepo: INotificationTemplateRepository;
  private readonly userService: IUserService;
  private readonly notificationChannel: INotificationChannel;

  constructor(dependencies: SendNotificationDependencies) {
    this.notificationRepo = dependencies.notificationRepo;
    this.preferencesRepo = dependencies.preferencesRepo;
    this.templateRepo = dependencies.templateRepo;
    this.userService = dependencies.userService;
    this.notificationChannel = dependencies.notificationChannel;
  }

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
      const saved = await this.preferencesRepo.findByUserIds(ids);
      for (const preferences of saved) {
        preferencesByUser.set(preferences.userId, preferences);
      }
    }
    const preferencesOf = (recipientId: string) =>
      preferencesByUser.get(recipientId) ??
      UserPreferences.defaultsFor(recipientId);

    // 4. One notification per recipient who has not muted this event
    // type, or per recipient when the notification is mandatory
    const notifications = recipientIds
      .filter(
        (recipientId) =>
          input.mandatory === true ||
          !preferencesOf(recipientId).isMuted(input.templateKey),
      )
      .map(
        (recipientId) =>
          new Notification({
            id: randomUUID(),
            recipientId,
            actorId: input.actorId || null,
            templateKey: input.templateKey,
            variables: input.variables,
            metadata: input.metadata,
            read: false,
            readTime: null,
            createdAt: new Date(),
            trashTime: null,
            eventId: input.eventId ?? null,
          }),
      );

    // 5. Save by batch, then send each saved batch to the active channels
    // (WebSocket): a notification is never sent before it is saved. A failed
    // batch stops the dispatch; the batches before it stay saved and sent.
    // Sent again with its key, the dispatch completes the recipients left
    // out, and gives nothing again to the others: saveMany leaves them out.
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
