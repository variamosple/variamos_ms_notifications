import { z } from "zod";
import { JsonValue } from "../../Domain/Entities/JsonValue.js";

// Recursive Zod Schema to strictly validate JSON payloads without any/unknown
export const JsonSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(JsonSchema),
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
  .record(JsonSchema)
  .refine((record) => isBoundedJson(record), {
    message: `Too large: at most ${JSON_LIMITS.depth} levels, ${JSON_LIMITS.keys} keys, ${JSON_LIMITS.items} items and ${JSON_LIMITS.stringLength} characters per value`,
  });

const Identifier = z.string().trim().min(1).max(128);

export const SendNotificationSchema = z.object({
  recipients: z
    .object({
      userIds: z.array(Identifier).optional(),
      roles: z.array(z.string()).optional(),
    })
    .refine((data) => !data.roles || data.roles.length === 0, {
      // The admin service resolves roles into user ids before sending
      // (EV-99, CA-NT-02, option a); this service cannot resolve them.
      message:
        "Role recipients are not supported: resolve them into userIds before sending",
      path: ["roles"],
    })
    .refine((data) => data.userIds && data.userIds.length > 0, {
      message: "At least one recipient in userIds must be provided",
      path: ["userIds"],
    }),
  templateKey: z.string().min(1).max(100),
  variables: BoundedJsonRecord.default({}),
  metadata: BoundedJsonRecord.default({}),
  actorId: Identifier.nullable().optional(),
});

export type SendNotificationDto = z.infer<typeof SendNotificationSchema>;
