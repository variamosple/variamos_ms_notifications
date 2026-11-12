import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Principal } from "../../Domain/Entities/Principal.js";
import { GetInboxUseCase } from "../../UseCases/GetInboxUseCase.js";
import { MarkAllAsReadUseCase } from "../../UseCases/MarkAllAsReadUseCase.js";
import { MarkAsReadUseCase } from "../../UseCases/MarkAsReadUseCase.js";
import { SendNotificationUseCase } from "../../UseCases/SendNotificationUseCase.js";
import { CurrentPrincipal } from "../Auth/CurrentPrincipal.js";
import { SkipUserAccessCheck } from "../Auth/SkipUserAccessCheck.js";
import {
  type InboxQuery,
  InboxQuerySchema,
  type RecipientQuery,
  RecipientQuerySchema,
} from "../DTOs/QueryDtos.js";
import { toNotificationResponse } from "../DTOs/Responses.js";
import type { SendNotificationDto } from "../DTOs/SendNotificationDto.js";
import { SendNotificationSchema } from "../DTOs/SendNotificationDto.js";
import { DomainErrorFilter } from "../Filters/DomainErrorFilter.js";
import { NotificationInternalGuard } from "../Guards/NotificationInternalGuard.js";
import { ZodQueryPipe } from "../Pipes/ZodQueryPipe.js";
import { ZodValidationPipe } from "../Pipes/ZodValidationPipe.js";
import { recipientOf } from "./recipientOf.js";

/** Sending notifications, and the inbox of a user: reading and marking them. */
@Controller("notifications")
@UseFilters(DomainErrorFilter)
export class NotificationController {
  constructor(
    private readonly sendNotificationUseCase: SendNotificationUseCase,
    private readonly getInboxUseCase: GetInboxUseCase,
    private readonly markAsReadUseCase: MarkAsReadUseCase,
    private readonly markAllAsReadUseCase: MarkAllAsReadUseCase,
  ) {}

  @Post()
  @SkipUserAccessCheck()
  @SkipThrottle()
  @UseGuards(NotificationInternalGuard)
  @UsePipes(new ZodValidationPipe(SendNotificationSchema))
  @HttpCode(HttpStatus.CREATED)
  public async send(@Body() dto: SendNotificationDto) {
    const sent = await this.sendNotificationUseCase.execute({
      recipients: dto.recipients,
      templateKey: dto.templateKey,
      variables: dto.variables,
      metadata: dto.metadata,
      actorId: dto.actorId,
      mandatory: dto.mandatory,
      eventId: dto.eventId,
    });
    return sent.map(toNotificationResponse);
  }

  @Get()
  public async getInbox(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(new ZodQueryPipe(InboxQuerySchema)) query: InboxQuery,
  ) {
    const notifications = await this.getInboxUseCase.execute({
      recipientId: recipientOf(principal, query.recipientId),
      page: query.page,
      limit: query.limit,
      folder: query.folder,
    });
    return notifications.map(toNotificationResponse);
  }

  @Patch(":id/read")
  public async markAsRead(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return toNotificationResponse(
      await this.markAsReadUseCase.execute(id, principal),
    );
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async markAllAsRead(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(new ZodQueryPipe(RecipientQuerySchema)) query: RecipientQuery,
  ) {
    await this.markAllAsReadUseCase.execute(
      recipientOf(principal, query.recipientId),
    );
  }
}
