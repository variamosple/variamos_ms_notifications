import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";
import { UserPreferences } from "../Domain/Entities/UserPreferences.js";
import { IUserPreferencesRepository } from "../Domain/Repositories/IUserPreferencesRepository.js";
import { ManagePreferencesUseCase } from "./ManagePreferencesUseCase.js";

describe("ManagePreferencesUseCase", () => {
  let preferencesRepo: MockProxy<IUserPreferencesRepository>;
  let useCase: ManagePreferencesUseCase;

  beforeEach(() => {
    preferencesRepo = mock<IUserPreferencesRepository>();
    useCase = new ManagePreferencesUseCase(preferencesRepo);
  });

  it("should retrieve preferences, returning defaults if not found", async () => {
    preferencesRepo.findByUserId.mockResolvedValue(null);

    const result = await useCase.get("user-1");

    expect(result.userId).toBe("user-1");
    expect(result.emailEnabled).toBe(true);
    expect(result.inAppEnabled).toBe(true);
    expect(result.mutedEventTypes).toEqual([]);
  });

  it("should retrieve existing preferences from repository", async () => {
    const existing = new UserPreferences("user-1", false, true, ["alert"]);
    preferencesRepo.findByUserId.mockResolvedValue(existing);

    const result = await useCase.get("user-1");

    expect(result).toBe(existing);
  });

  it("should update preferences and save them", async () => {
    const existing = new UserPreferences("user-1", true, false, []);
    preferencesRepo.findByUserId.mockResolvedValue(existing);
    preferencesRepo.save.mockImplementation(async (prefs) => prefs);

    const result = await useCase.update("user-1", {
      emailEnabled: false,
      inAppEnabled: true,
      mutedEventTypes: ["announcement"],
    });

    expect(result.emailEnabled).toBe(false);
    expect(result.inAppEnabled).toBe(true);
    expect(result.mutedEventTypes).toEqual(["announcement"]);
    expect(preferencesRepo.save).toHaveBeenCalledWith(result);
  });

  it("should update preferences by enabling email and disabling in-app", async () => {
    const existing = new UserPreferences("user-1", false, true, ["some_event"]);
    preferencesRepo.findByUserId.mockResolvedValue(existing);
    preferencesRepo.save.mockImplementation(async (prefs) => prefs);

    const result = await useCase.update("user-1", {
      emailEnabled: true,
      inAppEnabled: false,
    });

    expect(result.emailEnabled).toBe(true);
    expect(result.inAppEnabled).toBe(false);
    expect(result.mutedEventTypes).toEqual(["some_event"]);
  });

  it("should create new preferences on update if not found in database", async () => {
    preferencesRepo.findByUserId.mockResolvedValue(null);
    preferencesRepo.save.mockImplementation(async (prefs) => prefs);

    const result = await useCase.update("user-new", {
      emailEnabled: false,
    });

    expect(result.userId).toBe("user-new");
    expect(result.emailEnabled).toBe(false);
    expect(result.inAppEnabled).toBe(true);
  });

  it("should keep existing emailEnabled value if it is undefined in the input", async () => {
    const existing = new UserPreferences("user-1", true, true, []);
    preferencesRepo.findByUserId.mockResolvedValue(existing);
    preferencesRepo.save.mockImplementation(async (prefs) => prefs);

    const result = await useCase.update("user-1", {
      inAppEnabled: false,
    });

    expect(result.emailEnabled).toBe(true);
    expect(result.inAppEnabled).toBe(false);
  });
});
