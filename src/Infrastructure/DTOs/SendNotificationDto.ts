import { z } from "zod";
import { JsonValue } from "../../Domain/Entities/JsonValue.js";

// Recursive Zod Schema to strictly validate JSON payloads without any/unknown
const JsonSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(z.string(), JsonSchema),
  ]),
);

// Bounds of the variables and metadata of a notification: they are stored
// and sent to every recipient, so their size must stay small.
export const JSON_LIMITS = {
  depth: 5,
  keys: 50,
  items: 100,
  stringLength: 10_000,
};

/** True when a JSON value stays within JSON_LIMITS. */
export function isBoundedJson(value: JsonValue, depth = 0): boolean {
  if (typeof value === "string") {
    return value.length <= JSON_LIMITS.stringLength;
  }
  if (value === null || typeof value !== "object") return true;
  if (depth >= JSON_LIMITS.depth) return false;
  const children = Array.isArray(value) ? value : Object.values(value);
  const count = Array.isArray(value) ? value.length : children.length;
  const max = Array.isArray(value) ? JSON_LIMITS.items : JSON_LIMITS.keys;
  return (
    count <= max && children.every((child) => isBoundedJson(child, depth + 1))
  );
}

const BoundedJsonRecord = z
  .record(z.string(), JsonSchema)
  .refine((record) => isBoundedJson(record), {
    error: `Too large: at most ${JSON_LIMITS.depth} levels, ${JSON_LIMITS.keys} keys, ${JSON_LIMITS.items} items and ${JSON_LIMITS.stringLength} characters per value`,
  });

const Identifier = z.string().trim().min(1).max(128);

// The admin service sends every active account on a broadcast; the 100 kB
// body limit already caps valid ids at about 2,600.
export const MAX_RECIPIENTS = 5_000;
export const MAX_ROLES = 100;

/**
 * An array of at most `max` items, counted before its items are checked:
 * a long array is refused without one check, nor one issue, per item
 * (GHSA-mrhx-c7xc-m3w5).
 */
function boundedArray<T extends z.ZodType>(item: T, max: number) {
  return z
    .custom<unknown[]>((value) => Array.isArray(value) && value.length <= max, {
      error: `Expected an array of at most ${max} items`,
    })
    .pipe(z.array(item));
}

export const SendNotificationSchema = z.object({
  recipients: z
    .object({
      userIds: boundedArray(Identifier, MAX_RECIPIENTS).optional(),
      roles: boundedArray(z.string(), MAX_ROLES).optional(),
    })
    .refine((data) => !data.roles || data.roles.length === 0, {
      // The admin service resolves roles into user ids before sending
      // (EV-99, CA-NT-02, option a); this service cannot resolve them.
      error:
        "Role recipients are not supported: resolve them into userIds before sending",
      path: ["roles"],
    })
    .refine((data) => data.userIds && data.userIds.length > 0, {
      error: "At least one recipient in userIds must be provided",
      path: ["userIds"],
    }),
  templateKey: z.string().min(1).max(100),
  variables: BoundedJsonRecord.default({}),
  metadata: BoundedJsonRecord.default({}),
  actorId: Identifier.nullable().optional(),
});

export type SendNotificationDto = z.infer<typeof SendNotificationSchema>;
