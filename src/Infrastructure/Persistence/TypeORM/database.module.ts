import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_TEMPLATE_REPOSITORY,
  USER_PREFERENCES_REPOSITORY,
} from "../../Modules/injectionTokens.js";
import { NotificationEntity } from "./Entities/NotificationEntity.js";
import { NotificationTemplateEntity } from "./Entities/NotificationTemplateEntity.js";
import { UserPreferencesEntity } from "./Entities/UserPreferencesEntity.js";
import { NotificationTemplateTypeORMRepository } from "./Repositories/NotificationTemplateTypeORMRepository.js";
import { NotificationTypeORMRepository } from "./Repositories/NotificationTypeORMRepository.js";
import { UserPreferencesTypeORMRepository } from "./Repositories/UserPreferencesTypeORMRepository.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      NotificationTemplateEntity,
      UserPreferencesEntity,
    ]),
  ],
  providers: [
    {
      provide: NOTIFICATION_REPOSITORY,
      useClass: NotificationTypeORMRepository,
    },
    {
      provide: NOTIFICATION_TEMPLATE_REPOSITORY,
      useClass: NotificationTemplateTypeORMRepository,
    },
    {
      provide: USER_PREFERENCES_REPOSITORY,
      useClass: UserPreferencesTypeORMRepository,
    },
  ],
  exports: [
    NOTIFICATION_REPOSITORY,
    NOTIFICATION_TEMPLATE_REPOSITORY,
    USER_PREFERENCES_REPOSITORY,
    TypeOrmModule,
  ],
})
export class DatabaseModule {}
