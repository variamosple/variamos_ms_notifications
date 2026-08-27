import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserPreferences } from "../../../../Domain/Entities/UserPreferences.js";
import { IUserPreferencesRepository } from "../../../../Domain/Repositories/IUserPreferencesRepository.js";
import { UserPreferencesEntity } from "../Entities/UserPreferencesEntity.js";
import * as UserPreferencesMapper from "../Mappers/UserPreferencesMapper.js";

@Injectable()
export class UserPreferencesTypeORMRepository
  implements IUserPreferencesRepository
{
  constructor(
    @InjectRepository(UserPreferencesEntity)
    private readonly repository: Repository<UserPreferencesEntity>,
  ) {}

  public async findByUserId(userId: string): Promise<UserPreferences | null> {
    const entity = await this.repository.findOne({ where: { userId } });
    if (!entity) {
      return null;
    }
    return UserPreferencesMapper.toDomain(entity);
  }

  public async save(preferences: UserPreferences): Promise<UserPreferences> {
    const entity = UserPreferencesMapper.toPersistence(preferences);
    const savedEntity = await this.repository.save(entity);
    return UserPreferencesMapper.toDomain(savedEntity);
  }
}
