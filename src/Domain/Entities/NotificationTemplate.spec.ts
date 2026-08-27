import { describe, expect, it } from "vitest";
import { NotificationTemplate } from "./NotificationTemplate.js";

describe("NotificationTemplate", () => {
  it("should render template variables correctly", () => {
    const template = new NotificationTemplate(
      "test_key",
      "Welcome {{ name }}!",
      "Hello {{name}}, you have {{ count }} notifications.",
      new Date(),
    );

    const result = template.render({
      name: "Nathan",
      count: 5,
    });

    expect(result.title).toBe("Welcome Nathan!");
    expect(result.body).toBe("Hello Nathan, you have 5 notifications.");
  });

  it("should keep placeholder if variable is missing", () => {
    const template = new NotificationTemplate(
      "test_key",
      "Welcome {{ name }}!",
      "Hello {{ missing }}.",
      new Date(),
    );

    const result = template.render({
      name: "Nathan",
    });

    expect(result.title).toBe("Welcome Nathan!");
    expect(result.body).toBe("Hello {{ missing }}.");
  });
});
