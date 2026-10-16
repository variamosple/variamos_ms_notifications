import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  NotFoundException,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import {
  MissingRecipientError,
  NotificationNotFoundError,
} from "../../Domain/Errors/NotificationErrors.js";

/**
 * Turns the domain errors into HTTP answers: 404 for a notification that is
 * missing or belongs to someone else, 400 for a request without recipient.
 */
@Catch(NotificationNotFoundError, MissingRecipientError)
export class DomainErrorFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  public override catch(
    error: NotificationNotFoundError | MissingRecipientError,
    host: ArgumentsHost,
  ): void {
    const httpError =
      error instanceof NotificationNotFoundError
        ? new NotFoundException(error.message)
        : new BadRequestException(error.message);
    super.catch(httpError, host);
  }
}
