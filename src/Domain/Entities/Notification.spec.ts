import { describe, expect, it } from "vitest";
import { Notification } from "./Notification.js";

describe("Notification", () => {
  it("should initialize unread and not deleted", () => {
    const notif = new Notification({
      id: "id-1",
      recipientId: "user-1",
      actorId: null,
      templateKey: "test_key",
      variables: {},
      metadata: {},
      read: false,
      readTime: null,
      createdAt: new Date(),
    });

    expect(notif.isRead).toBe(false);
    expect(notif.readAt).toBeNull();
    expect(notif.deletedAt).toBeNull();
  });

  it("should mark as read and record current timestamp", () => {
    const notif = new Notification({
      id: "id-1",
      recipientId: "user-1",
      actorId: null,
      templateKey: "test_key",
      variables: {},
      metadata: {},
      read: false,
      readTime: null,
      createdAt: new Date(),
    });

    notif.markAsRead();
    expect(notif.isRead).toBe(true);
    const firstReadAt = notif.readAt;

    notif.markAsRead();
    expect(notif.readAt).toBe(firstReadAt);
  });

  it("should manage trash lifecycle correctly", () => {
    const notif = new Notification({
      id: "id-1",
      recipientId: "user-1",
      actorId: null,
      templateKey: "test_key",
      variables: {},
      metadata: {},
      read: false,
      readTime: null,
      createdAt: new Date(),
    });

    notif.moveToTrash();
    expect(notif.deletedAt).toBeInstanceOf(Date);
    const firstDeletedAt = notif.deletedAt;

    notif.moveToTrash();
    expect(notif.deletedAt).toBe(firstDeletedAt);

    notif.restoreFromTrash();
    expect(notif.deletedAt).toBeNull();
  });
});
