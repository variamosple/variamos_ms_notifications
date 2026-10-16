import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Principal } from "../../Domain/Entities/Principal.js";
import type { RequestWithPrincipal } from "./UserAccessGuard.js";

/**
 * The verified user of the request, set by UserAccessGuard; undefined when
 * the request has no valid access token (observe mode only).
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal | undefined =>
    context.switchToHttp().getRequest<RequestWithPrincipal>().principal,
);
