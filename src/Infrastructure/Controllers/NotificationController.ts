import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
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
import type { SendNotificationDto } from "../DTOs/SendNotificationDto.js";
import { SendNotificationSchema } from "../DTOs/SendNotificationDto.js";
import type { UpdatePreferencesDto } from "../DTOs/UpdatePreferencesDto.js";
import { UpdatePreferencesSchema } from "../DTOs/UpdatePreferencesDto.js";
import { DomainErrorFilter } from "../Filters/DomainErrorFilter.js";
import { NotificationInternalGuard } from "../Guards/NotificationInternalGuard.js";
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
  @UseGuards(NotificationInternalGuard)
  @UsePipes(new ZodValidationPipe(SendNotificationSchema))
  @HttpCode(HttpStatus.CREATED)
  public async send(@Body() dto: SendNotificationDto) {
    return this.sendNotificationUseCase.execute({
      recipients: dto.recipients,
      templateKey: dto.templateKey,
      variables: dto.variables,
      metadata: dto.metadata,
      actorId: dto.actorId,
    });
  }

  @Get()
  public async getInbox(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("recipientId") recipientId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "10",
    @Query("folder") folder: "inbox" | "trash" = "inbox",
  ) {
    const pageNum = Number.parseInt(page, 10) || 1;
    const limitNum = Number.parseInt(limit, 10) || 10;
    return this.getInboxUseCase.execute({
      recipientId: recipientOf(principal, recipientId) as string,
      page: pageNum,
      limit: limitNum,
      folder,
    });
  }

  @Patch(":id/read")
  public async markAsRead(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("id") id: string,
  ) {
    return this.markAsReadUseCase.execute(id, principal);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async markAllAsRead(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("recipientId") recipientId: string,
  ) {
    await this.markAllAsReadUseCase.execute(
      recipientOf(principal, recipientId) as string,
    );
  }

  @Delete("trash")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async emptyTrash(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("recipientId") recipientId: string,
  ) {
    await this.emptyTrashUseCase.execute(
      recipientOf(principal, recipientId) as string,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("id") id: string,
  ) {
    await this.deleteNotificationUseCase.execute(id, principal);
  }

  @Get("preferences")
  public async getPreferences(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("recipientId") recipientId: string,
  ) {
    return this.managePreferencesUseCase.get(
      recipientOf(principal, recipientId) as string,
    );
  }

  @Patch("preferences")
  public async updatePreferences(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("recipientId") recipientId: string,
    @Body(new ZodValidationPipe(UpdatePreferencesSchema))
    dto: UpdatePreferencesDto,
  ) {
    return this.managePreferencesUseCase.update(
      recipientOf(principal, recipientId) as string,
      dto,
    );
  }
}
