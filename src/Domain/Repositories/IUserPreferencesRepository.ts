import { UserPreferences } from "../Entities/UserPreferences.js";

export interface IUserPreferencesRepository {
  findByUserId(userId: string): Promise<UserPreferences | null>;
  // Users without saved preferences are absent from the result
  findByUserIds(userIds: string[]): Promise<UserPreferences[]>;
  save(preferences: UserPreferences): Promise<UserPreferences>;
}
