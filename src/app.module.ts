import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "./Infrastructure/Persistence/TypeORM/database.module.js";
import { NotificationEntity } from "./Infrastructure/Persistence/TypeORM/Entities/NotificationEntity.js";
import { NotificationTemplateEntity } from "./Infrastructure/Persistence/TypeORM/Entities/NotificationTemplateEntity.js";
import { UserPreferencesEntity } from "./Infrastructure/Persistence/TypeORM/Entities/UserPreferencesEntity.js";

@Module({
  imports: [
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
