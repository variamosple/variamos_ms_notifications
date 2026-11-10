import { describe, expect, it } from "vitest";
import {
  isBoundedJson,
  JSON_LIMITS,
  MAX_RECIPIENTS,
  MAX_ROLES,
  SendNotificationSchema,
} from "./SendNotificationDto.js";

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

describe("SendNotificationSchema recipients", () => {
  const send = (recipients: Record<string, unknown>) =>
    SendNotificationSchema.safeParse({
      recipients,
      templateKey: "admin_alert",
    });

  it(`accepts up to ${MAX_RECIPIENTS} user ids`, () => {
    const userIds = Array.from({ length: MAX_RECIPIENTS }, (_, i) => `u-${i}`);

    expect(send({ userIds }).success).toBe(true);
  });

  it("refuses a longer list with one issue, without checking each item", () => {
    const userIds = Array.from({ length: MAX_RECIPIENTS + 1 }, () => 1);

    const result = send({ userIds });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["recipients", "userIds"],
      message: `Expected an array of at most ${MAX_RECIPIENTS} items`,
    });
  });

  it("still checks each item of a list within the limit", () => {
    const result = send({ userIds: ["u-1", ""] });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["recipients", "userIds", 1]);
  });

  it(`refuses more than ${MAX_ROLES} roles with one issue`, () => {
    const roles = Array.from({ length: MAX_ROLES + 1 }, () => 1);

    const result = send({ userIds: ["u-1"], roles });

    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0].path).toEqual(["recipients", "roles"]);
  });
});

describe("SendNotificationSchema mandatory (EV-99)", () => {
  const send = (extra: Record<string, unknown>) =>
    SendNotificationSchema.safeParse({
      recipients: { userIds: ["user-1"] },
      templateKey: "admin_alert",
      ...extra,
    });

  it("leaves a notification mutable unless told otherwise", () => {
    expect(send({}).data?.mandatory).toBe(false);
    expect(send({ mandatory: true }).data?.mandatory).toBe(true);
  });

  it("refuses a value that is not a boolean", () => {
    expect(send({ mandatory: "yes" }).success).toBe(false);
  });
});

describe("SendNotificationSchema eventId (EV-99, CA-NT-05)", () => {
  const send = (extra: Record<string, unknown>) =>
    SendNotificationSchema.safeParse({
      recipients: { userIds: ["user-1"] },
      templateKey: "admin_alert",
      ...extra,
    });

  it("keeps the key of the send, trimmed, and leaves it out when absent", () => {
    expect(send({ eventId: " announcement-42 " }).data?.eventId).toBe(
      "announcement-42",
    );
    expect(send({}).data?.eventId).toBeUndefined();
  });

  it("refuses an empty key, a key over 128 characters and a key that is not a string", () => {
    expect(send({ eventId: "  " }).success).toBe(false);
    expect(send({ eventId: "k".repeat(129) }).success).toBe(false);
    expect(send({ eventId: 42 }).success).toBe(false);
  });
});
