import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs every HTTP request with method, path, status code, and duration.
 * Applied globally so every endpoint emits a structured log line.
 * Skips health-check paths to keep logs clean.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      ip?: string;
    }>();

    // Skip health / readiness probes
    if (req.url?.startsWith('/health')) return next.handle();

    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<{ statusCode: number }>();
          const ms = Date.now() - start;
          const status = res.statusCode;
          if (status >= 500) {
            this.logger.error(`${method} ${url} ${status} +${ms}ms`);
          } else if (status >= 400) {
            this.logger.warn(`${method} ${url} ${status} +${ms}ms`);
          } else {
            this.logger.log(`${method} ${url} ${status} +${ms}ms`);
          }
        },
        error: () => {
          const ms = Date.now() - start;
          this.logger.error(`${method} ${url} ERR +${ms}ms`);
        },
      }),
    );
  }
}
