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

/**
 * Shortest internal token that will be accepted once the module secrets are
 * renewed (ADR-0079, as in the admin service); until then, a warning.
 */
export const INTERNAL_TOKEN_MIN_LENGTH = 32;

// An empty value takes the default, as an absent one does: the service read
// them with `||` before (EV-45)
const emptyAsAbsent = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// A TCP port, or the default: no 0, no decimal, nothing out of range. The
// message names the rule, never the value.
const port = (fallback: number) => {
  const error = "must be a whole number from 1 to 65535";
  return z.preprocess(
    emptyAsAbsent,
    z.coerce
      .number({ error })
      .int({ error })
      .min(1, { error })
      .max(65535, { error })
      .default(fallback),
  );
};

const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    PORT: port(3000),
    NOTIFICATION_INTERNAL_TOKEN: z.string().optional(),
    DATABASE_HOST: z.string().optional(),
    DATABASE_PORT: port(5432),
    DATABASE_USERNAME: z.string().optional(),
    DATABASE_PASSWORD: z.string().optional(),
    DATABASE_NAME: z.string().optional(),
    DATABASE_SCHEMA: z.preprocess(
      emptyAsAbsent,
      z.string().default("variamos"),
    ),
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

/**
 * The validated configuration; throws on an invalid one. The service has
 * already stopped on it in validateEnv, so this only reads it again.
 */
export function readEnv(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  return envSchema.parse(env);
}

/** What the service starts with but should not: never a value or a length. */
function environmentWarnings(config: EnvConfig): string[] {
  const token = config.NOTIFICATION_INTERNAL_TOKEN?.trim();
  if (
    config.NODE_ENV === "production" &&
    token &&
    token.length < INTERNAL_TOKEN_MIN_LENGTH
  ) {
    return [
      `NOTIFICATION_INTERNAL_TOKEN is shorter than ${INTERNAL_TOKEN_MIN_LENGTH.toString()} characters: it will be refused once renewed`,
    ];
  }
  return [];
}

export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      "Invalid environment variables:",
      z.prettifyError(result.error),
    );
    process.exit(1);
  }

  for (const warning of environmentWarnings(result.data)) {
    console.warn(warning);
  }
  return result.data;
}
