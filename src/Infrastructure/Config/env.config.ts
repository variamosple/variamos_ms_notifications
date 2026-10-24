import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NOTIFICATION_INTERNAL_TOKEN: z
    .string({
      error: "NOTIFICATION_INTERNAL_TOKEN is required",
    })
    .default("dev-secret-token-12345678"),
  DATABASE_HOST: z.string().default("localhost"),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_USERNAME: z.string().default("postgres"),
  DATABASE_PASSWORD: z.string().default("postgres"),
  DATABASE_NAME: z.string().default("variamos_notifications"),
  DATABASE_SCHEMA: z.string().default("variamos"),
  // The default comes before the transform: zod 4 returns a default as is,
  // without running the transforms that follow it.
  DATABASE_SSL: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      "Invalid environment variables:",
      z.prettifyError(result.error),
    );
    process.exit(1);
  }

  return result.data;
}
