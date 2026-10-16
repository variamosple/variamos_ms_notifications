import { z } from "zod";

// Only read without an access token, in observe mode (ADR-0001)
const recipientId = z.string().trim().min(1).max(128).optional();

export const InboxQuerySchema = z.object({
  recipientId,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  folder: z.enum(["inbox", "trash"]).default("inbox"),
});

export type InboxQuery = z.infer<typeof InboxQuerySchema>;

export const RecipientQuerySchema = z.object({ recipientId });

export type RecipientQuery = z.infer<typeof RecipientQuerySchema>;
