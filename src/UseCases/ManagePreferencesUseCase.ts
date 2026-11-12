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

  public async get(userId: string | undefined): Promise<UserPreferences> {
    const recipientId = requireRecipient(userId);
    const preferences = await this.preferencesRepo.findByUserId(recipientId);
    if (!preferences) {
      return UserPreferences.defaultsFor(recipientId);
    }
    return preferences;
  }

  public async update(
    userId: string | undefined,
    input: UpdatePreferencesInput,
  ): Promise<UserPreferences> {
    const recipientId = requireRecipient(userId);
    const preferences =
      (await this.preferencesRepo.findByUserId(recipientId)) ??
      UserPreferences.defaultsFor(recipientId);

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
