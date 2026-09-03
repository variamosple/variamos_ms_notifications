import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthController } from "./Infrastructure/Controllers/HealthController.js";
import { NotificationModule } from "./Infrastructure/Modules/notification.module.js";
import { DatabaseModule } from "./Infrastructure/Persistence/TypeORM/database.module.js";
import { NotificationEntity } from "./Infrastructure/Persistence/TypeORM/Entities/NotificationEntity.js";
import { NotificationTemplateEntity } from "./Infrastructure/Persistence/TypeORM/Entities/NotificationTemplateEntity.js";
import { UserPreferencesEntity } from "./Infrastructure/Persistence/TypeORM/Entities/UserPreferencesEntity.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const ssl = process.env.DATABASE_SSL === "true";
        return {
          type: "postgres",
          host: process.env.DATABASE_HOST || "localhost",
          port: Number.parseInt(process.env.DATABASE_PORT || "5432", 10),
          username: process.env.DATABASE_USERNAME || "postgres",
          password: process.env.DATABASE_PASSWORD || "postgres",
          database: process.env.DATABASE_NAME || "variamos_notifications",
          schema: process.env.DATABASE_SCHEMA || "variamos",
          entities: [
            NotificationEntity,
            NotificationTemplateEntity,
            UserPreferencesEntity,
          ],
          synchronize: process.env.NODE_ENV !== "production",
          ssl: ssl ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    DatabaseModule,
    NotificationModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
