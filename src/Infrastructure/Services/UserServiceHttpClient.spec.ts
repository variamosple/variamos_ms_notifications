import { describe, expect, it } from "vitest";
import { UserServiceHttpClient } from "./UserServiceHttpClient.js";

describe("UserServiceHttpClient", () => {
  it("refuses to resolve roles instead of returning made-up ids", async () => {
    await expect(
      new UserServiceHttpClient().findUserIdsByRoles(["administrator"]),
    ).rejects.toThrow("Role resolution is not available");
  });
});
