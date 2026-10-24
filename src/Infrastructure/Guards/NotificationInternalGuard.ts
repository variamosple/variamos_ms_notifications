import { createHash, timingSafeEqual } from "node:crypto";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

// Digests have the same length whatever the tokens: a wrong token takes the
// same time to compare, whatever its length or common prefix (EV-69, CWE-208)
const digest = (value: string): Buffer =>
  createHash("sha256").update(value).digest();

const sameToken = (token: string, expected: string): boolean =>
  timingSafeEqual(digest(token), digest(expected));

@Injectable()
export class NotificationInternalGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers["x-internal-token"];
    const expectedToken = process.env.NOTIFICATION_INTERNAL_TOKEN;

    if (
      typeof token !== "string" ||
      !token ||
      !expectedToken ||
      !sameToken(token, expectedToken)
    ) {
      throw new UnauthorizedException("Invalid or missing internal token");
    }

    return true;
  }
}
