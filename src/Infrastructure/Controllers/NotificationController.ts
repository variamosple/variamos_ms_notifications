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
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { DeleteNotificationUseCase } from "../../UseCases/DeleteNotificationUseCase.js";
import { EmptyTrashUseCase } from "../../UseCases/EmptyTrashUseCase.js";
import { GetInboxUseCase } from "../../UseCases/GetInboxUseCase.js";
import { ManagePreferencesUseCase } from "../../UseCases/ManagePreferencesUseCase.js";
import { MarkAllAsReadUseCase } from "../../UseCases/MarkAllAsReadUseCase.js";
import { MarkAsReadUseCase } from "../../UseCases/MarkAsReadUseCase.js";
import { SendNotificationUseCase } from "../../UseCases/SendNotificationUseCase.js";
import type { SendNotificationDto } from "../DTOs/SendNotificationDto.js";
import { SendNotificationSchema } from "../DTOs/SendNotificationDto.js";
import type { UpdatePreferencesDto } from "../DTOs/UpdatePreferencesDto.js";
import { UpdatePreferencesSchema } from "../DTOs/UpdatePreferencesDto.js";
import { NotificationInternalGuard } from "../Guards/NotificationInternalGuard.js";
import { ZodValidationPipe } from "../Pipes/ZodValidationPipe.js";

@Controller("notifications")
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
    @Query("recipientId") recipientId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "10",
    @Query("folder") folder: "inbox" | "trash" = "inbox",
  ) {
    const pageNum = Number.parseInt(page, 10) || 1;
    const limitNum = Number.parseInt(limit, 10) || 10;
    return this.getInboxUseCase.execute({
      recipientId,
      page: pageNum,
      limit: limitNum,
      folder,
    });
  }

  @Patch(":id/read")
  public async markAsRead(@Param("id") id: string) {
    return this.markAsReadUseCase.execute(id);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async markAllAsRead(@Query("recipientId") recipientId: string) {
    await this.markAllAsReadUseCase.execute(recipientId);
  }

  @Delete("trash")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async emptyTrash(@Query("recipientId") recipientId: string) {
    await this.emptyTrashUseCase.execute(recipientId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(@Param("id") id: string) {
    await this.deleteNotificationUseCase.execute(id);
  }

  @Get("preferences")
  public async getPreferences(@Query("recipientId") recipientId: string) {
    return this.managePreferencesUseCase.get(recipientId);
  }

  @Patch("preferences")
  public async updatePreferences(
    @Query("recipientId") recipientId: string,
    @Body(new ZodValidationPipe(UpdatePreferencesSchema))
    dto: UpdatePreferencesDto,
  ) {
    return this.managePreferencesUseCase.update(recipientId, dto);
  }
}
