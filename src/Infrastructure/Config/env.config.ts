import { z } from "zod";

// Without these the service would run on test credentials, or refuse every
// call of the admin service: in production, it does not start (EV-69)
export const REQUIRED_IN_PRODUCTION = [
  "NOTIFICATION_INTERNAL_TOKEN",
  "DATABASE_HOST",
  "DATABASE_USERNAME",
  "DATABASE_PASSWORD",
  "DATABASE_NAME",
] as const;

const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    PORT: z.coerce.number().default(3000),
    NOTIFICATION_INTERNAL_TOKEN: z.string().optional(),
    DATABASE_HOST: z.string().optional(),
    DATABASE_PORT: z.coerce.number().default(5432),
    DATABASE_USERNAME: z.string().optional(),
    DATABASE_PASSWORD: z.string().optional(),
    DATABASE_NAME: z.string().optional(),
    DATABASE_SCHEMA: z.string().default("variamos"),
    // The default comes before the transform: zod 4 returns a default as is,
    // without running the transforms that follow it.
    DATABASE_SSL: z
      .string()
      .default("false")
      .transform((val) => val === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    for (const name of REQUIRED_IN_PRODUCTION) {
      if (!env[name]?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: [name],
          message: `${name} is required in production`,
        });
      }
    }
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
