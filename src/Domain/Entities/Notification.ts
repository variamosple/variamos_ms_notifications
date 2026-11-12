import { JsonValue } from "./JsonValue.js";

/** What a notification is made of; trash and event key are optional. */
export interface NotificationFields {
  id: string;
  recipientId: string;
  actorId: string | null;
  templateKey: string;
  variables: Record<string, JsonValue>;
  metadata: Record<string, JsonValue>;
  read: boolean;
  readTime: Date | null;
  createdAt: Date;
  trashTime?: Date | null;
  // The key of the send that created it, when its sender gave one: one
  // notification per key and recipient (EV-99)
  eventId?: string | null;
}

export class Notification {
  public readonly id: string;
  public readonly recipientId: string;
  public readonly actorId: string | null;
  public readonly templateKey: string;
  public readonly variables: Record<string, JsonValue>;
  public readonly metadata: Record<string, JsonValue>;
  public readonly createdAt: Date;
  public readonly eventId: string | null;
  // Read and trash state change only through the methods below
  private read: boolean;
  private readTime: Date | null;
  private trashTime: Date | null;

  constructor(fields: NotificationFields) {
    this.id = fields.id;
    this.recipientId = fields.recipientId;
    this.actorId = fields.actorId;
    this.templateKey = fields.templateKey;
    this.variables = fields.variables;
    this.metadata = fields.metadata;
    this.read = fields.read;
    this.readTime = fields.readTime;
    this.createdAt = fields.createdAt;
    this.trashTime = fields.trashTime ?? null;
    this.eventId = fields.eventId ?? null;
  }

  public get isRead(): boolean {
    return this.read;
  }

  public get readAt(): Date | null {
    return this.readTime;
  }

  public get deletedAt(): Date | null {
    return this.trashTime;
  }

  public belongsTo(userId: string): boolean {
    return this.recipientId === userId;
  }

  public markAsRead(): void {
    if (!this.read) {
      this.read = true;
      this.readTime = new Date();
    }
  }

  public moveToTrash(): void {
    this.trashTime ??= new Date();
  }

  public restoreFromTrash(): void {
    this.trashTime = null;
  }
}
