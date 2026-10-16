import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Principal } from "../../Domain/Entities/Principal.js";
import {
  ACCESS_CONTROL_MODE_TOKEN,
  type AccessControlMode,
} from "./AccessControlMode.js";
import { AccessTokenVerifier, bearerToken } from "./AccessTokenVerifier.js";
import { SKIP_USER_ACCESS_CHECK } from "./SkipUserAccessCheck.js";

export interface RequestWithPrincipal {
  method: string;
  path?: string;
  headers: Record<string, unknown>;
  principal?: Principal;
}

/**
 * Global guard: attaches the verified user to the request. Without a valid
 * token, the request is refused in "enforce" mode and only logged in
 * "observe" mode.
 */
@Injectable()
export class UserAccessGuard implements CanActivate {
  private readonly logger = new Logger(UserAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: AccessTokenVerifier,
    @Inject(ACCESS_CONTROL_MODE_TOKEN)
    private readonly mode: AccessControlMode,
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
    if (principal) {
      request.principal = principal;
      return true;
    }
    if (this.mode === "enforce") {
      throw new UnauthorizedException(
        "A valid notification access token is required.",
      );
    }
    this.logger.warn(
      `Observe mode: ${request.method} ${request.path ?? ""} without a valid access token`,
    );
    return true;
  }
}
