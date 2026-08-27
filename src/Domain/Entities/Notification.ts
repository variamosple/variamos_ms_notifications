import { JsonValue } from "./JsonValue.js";

export class Notification {
  constructor(
    public readonly id: string,
    public readonly recipientId: string,
    public readonly actorId: string | null,
    public readonly templateKey: string,
    public readonly variables: Record<string, JsonValue>,
    public readonly metadata: Record<string, JsonValue>,
    public isRead: boolean,
    public readAt: Date | null,
    public readonly createdAt: Date,
    public deletedAt: Date | null = null,
  ) {}

  public markAsRead(): void {
    if (!this.isRead) {
      this.isRead = true;
      this.readAt = new Date();
    }
  }

  public moveToTrash(): void {
    if (!this.deletedAt) {
      this.deletedAt = new Date();
    }
  }

  public restoreFromTrash(): void {
    this.deletedAt = null;
  }
}
