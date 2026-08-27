import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
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
      provide: "INotificationRepository",
      useClass: NotificationTypeORMRepository,
    },
    {
      provide: "INotificationTemplateRepository",
      useClass: NotificationTemplateTypeORMRepository,
    },
    {
      provide: "IUserPreferencesRepository",
      useClass: UserPreferencesTypeORMRepository,
    },
  ],
  exports: [
    "INotificationRepository",
    "INotificationTemplateRepository",
    "IUserPreferencesRepository",
    TypeOrmModule,
  ],
})
export class DatabaseModule {}
