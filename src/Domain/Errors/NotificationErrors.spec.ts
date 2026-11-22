import { describe, expect, it } from "vitest";
import { Notification } from "../Entities/Notification.js";
import {
  MissingRecipientError,
  NotificationNotFoundError,
  requireRecipient,
  TemplateNotConfiguredError,
} from "./NotificationErrors.js";

describe("requireRecipient", () => {
  it("returns a non-empty recipient", () => {
    expect(requireRecipient("user-1")).toBe("user-1");
  });

  it.each(["", "   ", undefined])("refuses %j", (value) => {
    expect(() => requireRecipient(value)).toThrow(MissingRecipientError);
  });
});

// The name tells the errors apart in the logs, and the message is what the
// log line says
describe.each([
  {
    make: () => new NotificationNotFoundError("n-1"),
    name: "NotificationNotFoundError",
    message: "Notification with ID 'n-1' not found",
  },
  {
    make: () => new MissingRecipientError(),
    name: "MissingRecipientError",
    message: "A recipient is required.",
  },
  {
    make: () => new TemplateNotConfiguredError("welcome"),
    name: "TemplateNotConfiguredError",
    message: "Template with key 'welcome' not found",
  },
])("$name", ({ make, name, message }) => {
  // Built in the test, so that a mutant of the class is seen by this test
  it("has its own name and message", () => {
    const error = make();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(name);
    expect(error.message).toBe(message);
  });
});

it("keeps the key of an unknown template", () => {
  expect(new TemplateNotConfiguredError("welcome").templateKey).toBe("welcome");
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
