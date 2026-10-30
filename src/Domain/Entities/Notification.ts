import { JsonValue } from "./JsonValue.js";

export class Notification {
  constructor(
    public readonly id: string,
    public readonly recipientId: string,
    public readonly actorId: string | null,
    public readonly templateKey: string,
    public readonly variables: Record<string, JsonValue>,
    public readonly metadata: Record<string, JsonValue>,
    // Read and trash state change only through the methods below
    private read: boolean,
    private readTime: Date | null,
    public readonly createdAt: Date,
    private trashTime: Date | null = null,
  ) {}

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
    if (!this.trashTime) {
      this.trashTime = new Date();
    }
  }

  public restoreFromTrash(): void {
    this.trashTime = null;
  }
}
