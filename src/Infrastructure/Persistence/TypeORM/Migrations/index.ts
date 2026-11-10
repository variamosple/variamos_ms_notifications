import { Baseline1792281600000 } from "./1792281600000-Baseline.js";
import { InboxIndex1793577600000 } from "./1793577600000-InboxIndex.js";
import { NotificationEventId1794268800000 } from "./1794268800000-NotificationEventId.js";
import { NotificationTemplates1794268800001 } from "./1794268800001-NotificationTemplates.js";

// Applied in order at start-up; a failure stops the service
export const NOTIFICATIONS_MIGRATIONS = [
  Baseline1792281600000,
  InboxIndex1793577600000,
  NotificationEventId1794268800000,
  NotificationTemplates1794268800001,
];

// The schema is shared with other services: a name of our own
export const NOTIFICATIONS_MIGRATIONS_TABLE = "notifications_migrations";
