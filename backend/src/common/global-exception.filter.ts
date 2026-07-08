import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode, ErrorCodeValue, buildApiError } from './error-codes';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const correlationId = request.correlationId;
    const requestPath = `${request.method} ${request.url}`;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let errorCode: ErrorCodeValue = ErrorCode.INTERNAL_ERROR;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message?: string }).message ?? exception.message;

      // Map HTTP status to error code
      if (statusCode === 401) errorCode = ErrorCode.AUTH_INVALID_CREDENTIALS;
      else if (statusCode === 403) errorCode = ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS;
      else if (statusCode === 404) errorCode = ErrorCode.RESOURCE_NOT_FOUND;
      else if (statusCode === 409) errorCode = ErrorCode.USER_ALREADY_EXISTS;
      else if (statusCode === 422) errorCode = ErrorCode.VALIDATION_FAILED;
      else if (statusCode === 429) errorCode = ErrorCode.RATE_LIMIT_EXCEEDED;
      else if (statusCode >= 500) errorCode = ErrorCode.INTERNAL_ERROR;
    } else if (exception instanceof Error) {
      // Never expose internal error details to client
      this.logger.error(`Unhandled error on ${requestPath}: ${exception.message}`, exception.stack);
    }

    // Log 5xx errors with full details for debugging
    if (statusCode >= 500) {
      this.logger.error(
        `[${correlationId ?? 'no-id'}] ${requestPath} → ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json(
      buildApiError(statusCode, errorCode, message, undefined, correlationId),
    );
  }
}
