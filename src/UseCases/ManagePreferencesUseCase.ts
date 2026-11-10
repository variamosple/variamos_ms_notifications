import { UserPreferences } from "../Domain/Entities/UserPreferences.js";
import { requireRecipient } from "../Domain/Errors/NotificationErrors.js";
import { IUserPreferencesRepository } from "../Domain/Repositories/IUserPreferencesRepository.js";

export interface UpdatePreferencesInput {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  mutedEventTypes?: string[];
}

export class ManagePreferencesUseCase {
  constructor(private readonly preferencesRepo: IUserPreferencesRepository) {}

  public async get(userId: string): Promise<UserPreferences> {
    requireRecipient(userId);
    const preferences = await this.preferencesRepo.findByUserId(userId);
    if (!preferences) {
      return UserPreferences.defaultsFor(userId);
    }
    return preferences;
  }

  public async update(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<UserPreferences> {
    requireRecipient(userId);
    let preferences = await this.preferencesRepo.findByUserId(userId);

    if (!preferences) {
      preferences = UserPreferences.defaultsFor(userId);
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
      preferences.muteOnly(input.mutedEventTypes);
    }

    return this.preferencesRepo.save(preferences);
  }
}
