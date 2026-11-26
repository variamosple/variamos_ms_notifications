import { z } from "zod";

// The recipient is the user of the access token. A `recipientId` or
// `userId` that an older client still sends is an unknown key: dropped,
// not refused (TRV-66).
export const InboxQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  folder: z.enum(["inbox", "trash"]).default("inbox"),
});

export type InboxQuery = z.infer<typeof InboxQuerySchema>;
