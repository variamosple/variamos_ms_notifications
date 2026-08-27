import { describe, expect, it } from "vitest";
import { Notification } from "./Notification.js";

describe("Notification", () => {
  it("should initialize unread and not deleted", () => {
    const notif = new Notification(
      "id-1",
      "user-1",
      null,
      "test_key",
      {},
      {},
      false,
      null,
      new Date(),
    );

    expect(notif.isRead).toBe(false);
    expect(notif.readAt).toBeNull();
    expect(notif.deletedAt).toBeNull();
  });

  it("should mark as read and record current timestamp", () => {
    const notif = new Notification(
      "id-1",
      "user-1",
      null,
      "test_key",
      {},
      {},
      false,
      null,
      new Date(),
    );

    notif.markAsRead();
    expect(notif.isRead).toBe(true);
    const firstReadAt = notif.readAt;

    notif.markAsRead();
    expect(notif.readAt).toBe(firstReadAt);
  });

  it("should manage trash lifecycle correctly", () => {
    const notif = new Notification(
      "id-1",
      "user-1",
      null,
      "test_key",
      {},
      {},
      false,
      null,
      new Date(),
    );

    notif.moveToTrash();
    expect(notif.deletedAt).toBeInstanceOf(Date);
    const firstDeletedAt = notif.deletedAt;

    notif.moveToTrash();
    expect(notif.deletedAt).toBe(firstDeletedAt);

    notif.restoreFromTrash();
    expect(notif.deletedAt).toBeNull();
  });
});
