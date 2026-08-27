import { UserPreferences } from "../Domain/Entities/UserPreferences.js";
import { IUserPreferencesRepository } from "../Domain/Repositories/IUserPreferencesRepository.js";

export interface UpdatePreferencesInput {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  mutedEventTypes?: string[];
}

export class ManagePreferencesUseCase {
  constructor(private readonly preferencesRepo: IUserPreferencesRepository) {}

  public async get(userId: string): Promise<UserPreferences> {
    const preferences = await this.preferencesRepo.findByUserId(userId);
    if (!preferences) {
      return new UserPreferences(userId, true, true, []);
    }
    return preferences;
  }

  public async update(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<UserPreferences> {
    let preferences = await this.preferencesRepo.findByUserId(userId);

    if (!preferences) {
      preferences = new UserPreferences(userId, true, true, []);
    }

    if (input.emailEnabled !== undefined) {
      if (input.emailEnabled) {
        preferences.enableEmail();
      } else {
        preferences.disableEmail();
      }
    }

    if (input.inAppEnabled !== undefined) {
      if (input.inAppEnabled) {
        preferences.enableInApp();
      } else {
        preferences.disableInApp();
      }
    }

    if (input.mutedEventTypes !== undefined) {
      preferences.mutedEventTypes = [...input.mutedEventTypes];
    }

    return this.preferencesRepo.save(preferences);
  }
}
