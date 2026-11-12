import { describe, expect, it } from "vitest";
import { Notification } from "../Entities/Notification.js";
import {
  MissingRecipientError,
  NotificationNotFoundError,
  requireRecipient,
} from "./NotificationErrors.js";

describe("requireRecipient", () => {
  it("returns a non-empty recipient", () => {
    expect(requireRecipient("user-1")).toBe("user-1");
  });

  it.each(["", "   ", undefined])("refuses %j", (value) => {
    expect(() => requireRecipient(value)).toThrow(MissingRecipientError);
  });
});

describe("NotificationNotFoundError", () => {
  it("names the notification", () => {
    expect(new NotificationNotFoundError("n-1").message).toBe(
      "Notification with ID 'n-1' not found",
    );
  });
});

describe("Notification.belongsTo", () => {
  const notification = new Notification({
    id: "n-1",
    recipientId: "user-1",
    actorId: null,
    templateKey: "welcome",
    variables: {},
    metadata: {},
    read: false,
    readTime: null,
    createdAt: new Date(),
  });

  it("is true for its recipient only", () => {
    expect(notification.belongsTo("user-1")).toBe(true);
    expect(notification.belongsTo("user-2")).toBe(false);
  });
});
