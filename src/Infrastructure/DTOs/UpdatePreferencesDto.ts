import { z } from "zod";

export const UpdatePreferencesSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    mutedEventTypes: z.array(z.string()).optional(),
  })
  .strict(); // Enforce strict properties verification to block unwanted fields

export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesSchema>;
