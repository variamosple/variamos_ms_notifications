import {
  Body,
  Controller,
  Delete,
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
import { DeleteNotificationUseCase } from "../../UseCases/DeleteNotificationUseCase.js";
import { EmptyTrashUseCase } from "../../UseCases/EmptyTrashUseCase.js";
import { GetInboxUseCase } from "../../UseCases/GetInboxUseCase.js";
import { ManagePreferencesUseCase } from "../../UseCases/ManagePreferencesUseCase.js";
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
import {
  toNotificationResponse,
  toPreferencesResponse,
} from "../DTOs/Responses.js";
import type { SendNotificationDto } from "../DTOs/SendNotificationDto.js";
import { SendNotificationSchema } from "../DTOs/SendNotificationDto.js";
import type { UpdatePreferencesDto } from "../DTOs/UpdatePreferencesDto.js";
import { UpdatePreferencesSchema } from "../DTOs/UpdatePreferencesDto.js";
import { DomainErrorFilter } from "../Filters/DomainErrorFilter.js";
import { NotificationInternalGuard } from "../Guards/NotificationInternalGuard.js";
import { ZodQueryPipe } from "../Pipes/ZodQueryPipe.js";
import { ZodValidationPipe } from "../Pipes/ZodValidationPipe.js";

/**
 * The recipient of a user route is the verified user of the access token.
 * The `recipientId` query parameter is only read for a request without a
 * valid token, in observe mode (ADR-0001), and is ignored otherwise.
 */
function recipientOf(
  principal: Principal | undefined,
  recipientId: string | undefined,
): string | undefined {
  return principal ? principal.userId : recipientId;
}

@Controller("notifications")
@UseFilters(DomainErrorFilter)
export class NotificationController {
  constructor(
    private readonly sendNotificationUseCase: SendNotificationUseCase,
    private readonly getInboxUseCase: GetInboxUseCase,
    private readonly markAsReadUseCase: MarkAsReadUseCase,
    private readonly markAllAsReadUseCase: MarkAllAsReadUseCase,
    private readonly emptyTrashUseCase: EmptyTrashUseCase,
    private readonly deleteNotificationUseCase: DeleteNotificationUseCase,
    private readonly managePreferencesUseCase: ManagePreferencesUseCase,
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
    });
    return sent.map(toNotificationResponse);
  }

  @Get()
  public async getInbox(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(new ZodQueryPipe(InboxQuerySchema)) query: InboxQuery,
  ) {
    const notifications = await this.getInboxUseCase.execute({
      recipientId: recipientOf(principal, query.recipientId) as string,
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
      recipientOf(principal, query.recipientId) as string,
    );
  }

  @Delete("trash")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async emptyTrash(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(new ZodQueryPipe(RecipientQuerySchema)) query: RecipientQuery,
  ) {
    await this.emptyTrashUseCase.execute(
      recipientOf(principal, query.recipientId) as string,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    await this.deleteNotificationUseCase.execute(id, principal);
  }

  @Get("preferences")
  public async getPreferences(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(new ZodQueryPipe(RecipientQuerySchema)) query: RecipientQuery,
  ) {
    return toPreferencesResponse(
      await this.managePreferencesUseCase.get(
        recipientOf(principal, query.recipientId) as string,
      ),
    );
  }

  @Patch("preferences")
  public async updatePreferences(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(new ZodQueryPipe(RecipientQuerySchema)) query: RecipientQuery,
    @Body(new ZodValidationPipe(UpdatePreferencesSchema))
    dto: UpdatePreferencesDto,
  ) {
    return toPreferencesResponse(
      await this.managePreferencesUseCase.update(
        recipientOf(principal, query.recipientId) as string,
        dto,
      ),
    );
  }
}
