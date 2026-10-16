import { describe, expect, it } from "vitest";
import { isBoundedJson, JSON_LIMITS } from "./SendNotificationDto.js";

const nested = (levels: number): Record<string, unknown> =>
  levels === 0 ? { leaf: 1 } : { child: nested(levels - 1) };

describe("isBoundedJson", () => {
  it("accepts objects nested up to the depth limit", () => {
    expect(isBoundedJson(nested(JSON_LIMITS.depth - 1) as never)).toBe(true);
  });

  it("refuses objects nested deeper", () => {
    expect(isBoundedJson(nested(JSON_LIMITS.depth) as never)).toBe(false);
  });

  it("limits the length of strings, the number of keys and of items", () => {
    expect(isBoundedJson("x".repeat(JSON_LIMITS.stringLength))).toBe(true);
    expect(isBoundedJson("x".repeat(JSON_LIMITS.stringLength + 1))).toBe(false);
    expect(
      isBoundedJson(Array.from({ length: JSON_LIMITS.items + 1 }, () => 1)),
    ).toBe(false);
    expect(
      isBoundedJson(
        Object.fromEntries(
          Array.from({ length: JSON_LIMITS.keys + 1 }, (_, i) => [`k${i}`, i]),
        ),
      ),
    ).toBe(false);
  });

  it("accepts plain values", () => {
    expect(isBoundedJson(null)).toBe(true);
    expect(isBoundedJson(42)).toBe(true);
    expect(isBoundedJson({ name: "Ana", tags: ["a", "b"] })).toBe(true);
  });
});
