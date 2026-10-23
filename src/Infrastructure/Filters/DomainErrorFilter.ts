import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import {
  MissingRecipientError,
  NotificationNotFoundError,
  TemplateNotConfiguredError,
} from "../../Domain/Errors/NotificationErrors.js";

type DomainError =
  | NotificationNotFoundError
  | MissingRecipientError
  | TemplateNotConfiguredError;

/** Stable codes of the domain errors, next to the HTTP status (T-16). */
const ErrorCodes = {
  NOTIFICATION_NOT_FOUND: "NOTIFICATION_NOT_FOUND",
  MISSING_RECIPIENT: "MISSING_RECIPIENT",
  TEMPLATE_NOT_CONFIGURED: "TEMPLATE_NOT_CONFIGURED",
} as const;

/**
 * Turns the domain errors into HTTP answers: 404 for a notification that is
 * missing or belongs to someone else, 400 for a request without recipient,
 * 500 for a template that is not configured. The body keeps the NestJS
 * fields and adds a stable errorCode.
 */
@Catch(
  NotificationNotFoundError,
  MissingRecipientError,
  TemplateNotConfiguredError,
)
export class DomainErrorFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(DomainErrorFilter.name);

  public override catch(error: DomainError, host: ArgumentsHost): void {
    super.catch(this.toHttpError(error), host);
  }

  private toHttpError(error: DomainError): HttpException {
    if (error instanceof NotificationNotFoundError) {
      return new NotFoundException({
        statusCode: 404,
        error: "Not Found",
        errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND,
        message: error.message,
      });
    }
    if (error instanceof TemplateNotConfiguredError) {
      this.logger.error(
        `No notification template is configured for '${error.templateKey}'`,
      );
      return new InternalServerErrorException({
        statusCode: 500,
        error: "Internal Server Error",
        errorCode: ErrorCodes.TEMPLATE_NOT_CONFIGURED,
        message: "The notification template is not configured.",
      });
    }
    return new BadRequestException({
      statusCode: 400,
      error: "Bad Request",
      errorCode: ErrorCodes.MISSING_RECIPIENT,
      message: error.message,
    });
  }
}
