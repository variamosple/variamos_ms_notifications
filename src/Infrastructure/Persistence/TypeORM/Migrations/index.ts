import { Baseline1792281600000 } from "./1792281600000-Baseline.js";

// Applied in order at start-up; a failure stops the service
export const NOTIFICATIONS_MIGRATIONS = [Baseline1792281600000];

// The schema is shared with other services: a name of our own
export const NOTIFICATIONS_MIGRATIONS_TABLE = "notifications_migrations";
