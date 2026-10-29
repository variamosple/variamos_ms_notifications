import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { INotificationRepository } from "../../Domain/Repositories/INotificationRepository.js";
import { INotificationTemplateRepository } from "../../Domain/Repositories/INotificationTemplateRepository.js";
import { IUserPreferencesRepository } from "../../Domain/Repositories/IUserPreferencesRepository.js";
import { INotificationChannel } from "../../Domain/Services/INotificationChannel.js";
import { IUserService } from "../../Domain/Services/IUserService.js";
import { DeleteNotificationUseCase } from "../../UseCases/DeleteNotificationUseCase.js";
import { EmptyTrashUseCase } from "../../UseCases/EmptyTrashUseCase.js";
import { GetInboxUseCase } from "../../UseCases/GetInboxUseCase.js";
import { ManagePreferencesUseCase } from "../../UseCases/ManagePreferencesUseCase.js";
import { MarkAllAsReadUseCase } from "../../UseCases/MarkAllAsReadUseCase.js";
import { MarkAsReadUseCase } from "../../UseCases/MarkAsReadUseCase.js";
import { SendNotificationUseCase } from "../../UseCases/SendNotificationUseCase.js";
import {
  ACCESS_CONTROL_MODE,
  ACCESS_CONTROL_MODE_TOKEN,
} from "../Auth/AccessControlMode.js";
import { AccessTokenVerifier } from "../Auth/AccessTokenVerifier.js";
import { UserAccessGuard } from "../Auth/UserAccessGuard.js";
import {
  RATE_LIMIT,
  UserAwareThrottlerGuard,
} from "../Auth/UserAwareThrottlerGuard.js";
import { NotificationController } from "../Controllers/NotificationController.js";
import { DatabaseModule } from "../Persistence/TypeORM/database.module.js";
import { UserServiceHttpClient } from "../Services/UserServiceHttpClient.js";
import {
  NotificationGateway,
  RootNotificationGateway,
} from "../WebSockets/NotificationGateway.js";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_REPOSITORY,
  NOTIFICATION_TEMPLATE_REPOSITORY,
  USER_PREFERENCES_REPOSITORY,
  USER_SERVICE,
} from "./injectionTokens.js";

@Module({
  imports: [DatabaseModule, ThrottlerModule.forRoot([RATE_LIMIT])],
  controllers: [NotificationController],
  providers: [
    AccessTokenVerifier,
    { provide: ACCESS_CONTROL_MODE_TOKEN, useValue: ACCESS_CONTROL_MODE },
    // Every HTTP route checks the user access token, unless it is marked
    // with @SkipUserAccessCheck() (ADR-0001)
    { provide: APP_GUARD, useClass: UserAccessGuard },
    // After UserAccessGuard: the limit is per user when a token is present
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
    RootNotificationGateway,
    NotificationGateway,
    {
      provide: NOTIFICATION_CHANNEL,
      useExisting: NotificationGateway,
    },
    {
      provide: USER_SERVICE,
      useClass: UserServiceHttpClient,
    },
    // Factory Providers for Use Cases to decouple them from NestJS framework
    {
      provide: SendNotificationUseCase,
      useFactory: (
        notificationRepo: INotificationRepository,
        preferencesRepo: IUserPreferencesRepository,
        templateRepo: INotificationTemplateRepository,
        userService: IUserService,
        notificationChannel: INotificationChannel,
      ) =>
        new SendNotificationUseCase(
          notificationRepo,
          preferencesRepo,
          templateRepo,
          userService,
          notificationChannel,
        ),
      inject: [
        NOTIFICATION_REPOSITORY,
        USER_PREFERENCES_REPOSITORY,
        NOTIFICATION_TEMPLATE_REPOSITORY,
        USER_SERVICE,
        NOTIFICATION_CHANNEL,
      ],
    },
    {
      provide: GetInboxUseCase,
      useFactory: (notificationRepo: INotificationRepository) =>
        new GetInboxUseCase(notificationRepo),
      inject: [NOTIFICATION_REPOSITORY],
    },
    {
      provide: MarkAsReadUseCase,
      useFactory: (notificationRepo: INotificationRepository) =>
        new MarkAsReadUseCase(notificationRepo),
      inject: [NOTIFICATION_REPOSITORY],
    },
    {
      provide: MarkAllAsReadUseCase,
      useFactory: (notificationRepo: INotificationRepository) =>
        new MarkAllAsReadUseCase(notificationRepo),
      inject: [NOTIFICATION_REPOSITORY],
    },
    {
      provide: EmptyTrashUseCase,
      useFactory: (notificationRepo: INotificationRepository) =>
        new EmptyTrashUseCase(notificationRepo),
      inject: [NOTIFICATION_REPOSITORY],
    },
    {
      provide: DeleteNotificationUseCase,
      useFactory: (notificationRepo: INotificationRepository) =>
        new DeleteNotificationUseCase(notificationRepo),
      inject: [NOTIFICATION_REPOSITORY],
    },
    {
      provide: ManagePreferencesUseCase,
      useFactory: (preferencesRepo: IUserPreferencesRepository) =>
        new ManagePreferencesUseCase(preferencesRepo),
      inject: [USER_PREFERENCES_REPOSITORY],
    },
  ],
})
export class NotificationModule {}
