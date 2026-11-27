import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { readEnv } from "./Infrastructure/Config/env.config.js";
import { HealthController } from "./Infrastructure/Controllers/HealthController.js";
import { NotificationModule } from "./Infrastructure/Modules/notification.module.js";
import { DatabaseModule } from "./Infrastructure/Persistence/TypeORM/database.module.js";
import { databaseOptions } from "./Infrastructure/Persistence/TypeORM/databaseOptions.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Read after validateEnv, which stopped the service on an invalid
    // configuration
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseOptions(readEnv()),
    }),
    DatabaseModule,
    NotificationModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
