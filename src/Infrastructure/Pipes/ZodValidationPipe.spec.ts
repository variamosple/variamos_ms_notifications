import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ZodValidationPipe } from "./ZodValidationPipe.js";

describe("ZodValidationPipe", () => {
  const schema = z.object({
    username: z.string().min(3),
    age: z.number().min(18),
  });

  const pipe = new ZodValidationPipe(schema);

  it("should return parsed value if validation succeeds", () => {
    const input = { username: "john_doe", age: 25 };
    const result = pipe.transform(input);
    expect(result).toEqual(input);
  });

  it("should parse stringified JSON input and validate successfully", () => {
    const input = JSON.stringify({ username: "john_doe", age: 25 });
    const result = pipe.transform(input);
    expect(result).toEqual({ username: "john_doe", age: 25 });
  });

  it("should throw BadRequestException if validation fails", () => {
    const input = { username: "na", age: 15 };
    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });
});
