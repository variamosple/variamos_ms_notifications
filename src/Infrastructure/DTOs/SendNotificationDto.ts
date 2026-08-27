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

export const SendNotificationSchema = z.object({
  recipients: z
    .object({
      userIds: z.array(z.string()).optional(),
      roles: z.array(z.string()).optional(),
    })
    .refine(
      (data) =>
        (data.userIds && data.userIds.length > 0) ||
        (data.roles && data.roles.length > 0),
      {
        message: "At least one recipient (userIds or roles) must be provided",
        path: ["userIds"],
      },
    ),
  templateKey: z.string().min(1),
  variables: z.record(JsonSchema).default({}),
  metadata: z.record(JsonSchema).default({}),
  actorId: z.string().nullable().optional(),
});

export type SendNotificationDto = z.infer<typeof SendNotificationSchema>;
