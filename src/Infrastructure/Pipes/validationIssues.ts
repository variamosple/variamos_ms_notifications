import type { ZodError } from "zod";

/** One validation problem, as the client sees it. */
export interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

/**
 * Keeps the path and the message of each Zod issue, without the internal
 * structure of Zod (codes, nested union errors) (T-16).
 */
export const validationIssues = (error: ZodError): ValidationIssue[] =>
  error.errors.map(({ path, message }) => ({ path, message }));
