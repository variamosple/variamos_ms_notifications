import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class NotificationInternalGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers["x-internal-token"];
    const expectedToken = process.env.NOTIFICATION_INTERNAL_TOKEN;

    if (!token || token !== expectedToken) {
      throw new UnauthorizedException("Invalid or missing internal token");
    }

    return true;
  }
}
