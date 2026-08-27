import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NOTIFICATION_INTERNAL_TOKEN: z
    .string({
      required_error: "NOTIFICATION_INTERNAL_TOKEN is required",
    })
    .default("dev-secret-token-12345678"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    process.exit(1);
  }

  return result.data;
}
