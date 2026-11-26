import { Body, Controller, Get, Patch, UseFilters } from "@nestjs/common";
import type { Principal } from "../../Domain/Entities/Principal.js";
import { ManagePreferencesUseCase } from "../../UseCases/ManagePreferencesUseCase.js";
import { CurrentPrincipal } from "../Auth/CurrentPrincipal.js";
import { toPreferencesResponse } from "../DTOs/Responses.js";
import type { UpdatePreferencesDto } from "../DTOs/UpdatePreferencesDto.js";
import { UpdatePreferencesSchema } from "../DTOs/UpdatePreferencesDto.js";
import { DomainErrorFilter } from "../Filters/DomainErrorFilter.js";
import { ZodValidationPipe } from "../Pipes/ZodValidationPipe.js";

/** The notification preferences of a user. */
@Controller("notifications")
@UseFilters(DomainErrorFilter)
export class NotificationPreferencesController {
  constructor(
    private readonly managePreferencesUseCase: ManagePreferencesUseCase,
  ) {}

  @Get("preferences")
  public async getPreferences(@CurrentPrincipal() principal: Principal) {
    return toPreferencesResponse(
      await this.managePreferencesUseCase.get(principal.userId),
    );
  }

  @Patch("preferences")
  public async updatePreferences(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(UpdatePreferencesSchema))
    dto: UpdatePreferencesDto,
  ) {
    return toPreferencesResponse(
      await this.managePreferencesUseCase.update(principal.userId, dto),
    );
  }
}
