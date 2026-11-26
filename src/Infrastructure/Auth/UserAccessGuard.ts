import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Principal } from "../../Domain/Entities/Principal.js";
import { AccessTokenVerifier, bearerToken } from "./AccessTokenVerifier.js";
import { SKIP_USER_ACCESS_CHECK } from "./SkipUserAccessCheck.js";

export interface RequestWithPrincipal {
  method: string;
  path?: string;
  headers: Record<string, unknown>;
  principal?: Principal;
}

/**
 * Global guard: attaches the verified user to the request, and refuses a
 * request without a valid access token (ADR-0001). The recipient of a user
 * route is always this user, never a parameter of the request (TRV-66).
 */
@Injectable()
export class UserAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: AccessTokenVerifier,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_USER_ACCESS_CHECK,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = await this.verifier.verify(
      bearerToken(request.headers.authorization),
    );
    if (!principal) {
      throw new UnauthorizedException(
        "A valid notification access token is required.",
      );
    }
    request.principal = principal;
    return true;
  }
}
