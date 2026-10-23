/**
 * The notification does not exist, or does not belong to the caller: both
 * answer the same, so a caller cannot learn that another user's
 * notification exists.
 */
export class NotificationNotFoundError extends Error {
  constructor(id: string) {
    super(`Notification with ID '${id}' not found`);
    this.name = "NotificationNotFoundError";
  }
}

/**
 * An operation on "all the notifications of a recipient" without a
 * recipient: it must never run unscoped (CA-NT-01).
 */
export class MissingRecipientError extends Error {
  constructor() {
    super("A recipient is required.");
    this.name = "MissingRecipientError";
  }
}

/**
 * No template is configured for the key of a dispatch: a server-side
 * configuration fault, told apart from an outage by its code (T-16).
 */
export class TemplateNotConfiguredError extends Error {
  constructor(public readonly templateKey: string) {
    super(`Template with key '${templateKey}' not found`);
    this.name = "TemplateNotConfiguredError";
  }
}

export function requireRecipient(recipientId: string | undefined): string {
  if (typeof recipientId !== "string" || recipientId.trim() === "") {
    throw new MissingRecipientError();
  }
  return recipientId;
}
