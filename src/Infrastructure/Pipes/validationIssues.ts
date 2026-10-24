import type { ZodError } from "zod";

/** One validation problem, as the client sees it. */
export interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

/**
 * Keeps the path and the message of each Zod issue, without the internal
 * structure of Zod (codes, nested union errors) (T-16). A symbol key, which
 * JSON cannot carry, is written as text.
 */
export const validationIssues = (error: ZodError): ValidationIssue[] =>
  error.issues.map(({ path, message }) => ({
    path: path.map((key) => (typeof key === "symbol" ? String(key) : key)),
    message,
  }));
