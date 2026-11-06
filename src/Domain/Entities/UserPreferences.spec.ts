import { describe, expect, it } from "vitest";
import { UserPreferences } from "./UserPreferences.js";

describe("UserPreferences", () => {
  it("should initialize with correct default preferences", () => {
    const prefs = new UserPreferences("user-1", true, true, []);
    expect(prefs.emailEnabled).toBe(true);
    expect(prefs.inAppEnabled).toBe(true);
    expect(prefs.isMuted("event_type")).toBe(false);
  });

  it("should enable and disable channels correctly", () => {
    const prefs = new UserPreferences("user-1", true, true, []);
    prefs.disableEmail();
    prefs.disableInApp();
    expect(prefs.emailEnabled).toBe(false);
    expect(prefs.inAppEnabled).toBe(false);

    prefs.enableEmail();
    prefs.enableInApp();
    expect(prefs.emailEnabled).toBe(true);
    expect(prefs.inAppEnabled).toBe(true);
  });

  it("mutes the admin alerts with the former key of the settings screen (EV-99)", () => {
    const prefs = new UserPreferences("user-1", true, true, ["system_alert"]);

    expect(prefs.isMuted("admin_alert")).toBe(true);
    expect(prefs.isMuted("review_assigned")).toBe(false);
    expect(prefs.mutedEventTypes).toEqual(["system_alert"]);
  });

  it("should mute and unmute event types correctly", () => {
    const prefs = new UserPreferences("user-1", true, true, []);
    prefs.muteEventType("review_assigned");
    prefs.muteEventType("system_announcement");
    expect(prefs.isMuted("review_assigned")).toBe(true);
    expect(prefs.isMuted("system_announcement")).toBe(true);

    prefs.muteEventType("review_assigned");
    expect(prefs.mutedEventTypes).toEqual([
      "review_assigned",
      "system_announcement",
    ]);

    prefs.unmuteEventType("review_assigned");
    expect(prefs.isMuted("review_assigned")).toBe(false);
    expect(prefs.isMuted("system_announcement")).toBe(true);
  });
});
