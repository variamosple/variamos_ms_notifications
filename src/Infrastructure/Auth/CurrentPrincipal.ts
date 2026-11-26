import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Principal } from "../../Domain/Entities/Principal.js";
import type { RequestWithPrincipal } from "./UserAccessGuard.js";

/**
 * The verified user of the request, set by UserAccessGuard. A route that
 * skips that guard has no user: reading it there refuses the request rather
 * than passing an empty user on.
 */
export function principalOf(request: RequestWithPrincipal): Principal {
  if (!request.principal) {
    throw new UnauthorizedException(
      "A valid notification access token is required.",
    );
  }
  return request.principal;
}

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal =>
    principalOf(context.switchToHttp().getRequest<RequestWithPrincipal>()),
);
