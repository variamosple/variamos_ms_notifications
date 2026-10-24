import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { validationIssues } from "./validationIssues.js";

describe("validationIssues", () => {
  it("keeps the path and message only, a symbol key written as text", () => {
    const error = new ZodError([
      {
        code: "custom",
        path: ["items", 0, Symbol("key")],
        message: "Invalid item",
        input: undefined,
      },
    ]);

    expect(validationIssues(error)).toEqual([
      { path: ["items", 0, "Symbol(key)"], message: "Invalid item" },
    ]);
  });
});
