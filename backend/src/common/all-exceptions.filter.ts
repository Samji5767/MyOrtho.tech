import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';

/**
 * Catches every unhandled exception and returns a consistent JSON envelope
 * instead of leaking stack traces. Logs server-side errors (5xx) so they show
 * up in observability without exposing internals to API clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: unknown = 'Internal server error';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message ?? res;
    }

    const correlationId: string | undefined =
      (request as any)?.correlationId ??
      (request?.headers?.[CORRELATION_ID_HEADER] as string | undefined);

    if (status >= 500) {
      this.logger.error(
        `${request?.method} ${request?.url} -> ${status} [${correlationId ?? 'no-correlation-id'}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      path: request?.url,
      timestamp: new Date().toISOString(),
      ...(correlationId ? { correlationId } : {}),
    });
  }
}
