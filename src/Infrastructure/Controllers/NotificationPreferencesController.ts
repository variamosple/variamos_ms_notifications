import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseFilters,
} from "@nestjs/common";
import type { Principal } from "../../Domain/Entities/Principal.js";
import { ManagePreferencesUseCase } from "../../UseCases/ManagePreferencesUseCase.js";
import { CurrentPrincipal } from "../Auth/CurrentPrincipal.js";
import {
  type RecipientQuery,
  RecipientQuerySchema,
} from "../DTOs/QueryDtos.js";
import { toPreferencesResponse } from "../DTOs/Responses.js";
import type { UpdatePreferencesDto } from "../DTOs/UpdatePreferencesDto.js";
import { UpdatePreferencesSchema } from "../DTOs/UpdatePreferencesDto.js";
import { DomainErrorFilter } from "../Filters/DomainErrorFilter.js";
import { ZodQueryPipe } from "../Pipes/ZodQueryPipe.js";
import { ZodValidationPipe } from "../Pipes/ZodValidationPipe.js";
import { recipientOf } from "./recipientOf.js";

/** The notification preferences of a user. */
@Controller("notifications")
@UseFilters(DomainErrorFilter)
export class NotificationPreferencesController {
  constructor(
    private readonly managePreferencesUseCase: ManagePreferencesUseCase,
  ) {}

  @Get("preferences")
  public async getPreferences(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(new ZodQueryPipe(RecipientQuerySchema)) query: RecipientQuery,
  ) {
    return toPreferencesResponse(
      await this.managePreferencesUseCase.get(
        recipientOf(principal, query.recipientId),
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
        recipientOf(principal, query.recipientId),
        dto,
      ),
    );
  }
}
