/**
 * Browser origins allowed to call the service (HTTP CORS and WebSocket).
 * In production the admin UI and this service share https://app.variamos.com,
 * so the list mostly serves local development (Vite on localhost).
 */
export const ALLOWED_ORIGINS: (string | RegExp)[] = [
  "https://app.variamos.com",
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

export function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some((allowed) =>
    typeof allowed === "string" ? allowed === origin : allowed.test(origin),
  );
}

/** CORS options of the HTTP API, used by main.ts. */
export const HTTP_CORS_OPTIONS = {
  origin: ALLOWED_ORIGINS,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true,
};
