import { UserPreferences } from "../Entities/UserPreferences.js";

export interface IUserPreferencesRepository {
  findByUserId(userId: string): Promise<UserPreferences | null>;
  save(preferences: UserPreferences): Promise<UserPreferences>;
}
