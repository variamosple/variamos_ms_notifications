import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseFilters,
} from "@nestjs/common";
import type { Principal } from "../../Domain/Entities/Principal.js";
import { DeleteNotificationUseCase } from "../../UseCases/DeleteNotificationUseCase.js";
import { EmptyTrashUseCase } from "../../UseCases/EmptyTrashUseCase.js";
import { CurrentPrincipal } from "../Auth/CurrentPrincipal.js";
import {
  type RecipientQuery,
  RecipientQuerySchema,
} from "../DTOs/QueryDtos.js";
import { DomainErrorFilter } from "../Filters/DomainErrorFilter.js";
import { ZodQueryPipe } from "../Pipes/ZodQueryPipe.js";
import { recipientOf } from "./recipientOf.js";

/** The trash of a user: emptying it, and deleting one notification. */
@Controller("notifications")
@UseFilters(DomainErrorFilter)
export class NotificationTrashController {
  constructor(
    private readonly emptyTrashUseCase: EmptyTrashUseCase,
    private readonly deleteNotificationUseCase: DeleteNotificationUseCase,
  ) {}

  @Delete("trash")
  @HttpCode(HttpStatus.NO_CONTENT)
  public async emptyTrash(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(new ZodQueryPipe(RecipientQuerySchema)) query: RecipientQuery,
  ) {
    await this.emptyTrashUseCase.execute(
      recipientOf(principal, query.recipientId),
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
}
