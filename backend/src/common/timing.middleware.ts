import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';

@Injectable()
export class TimingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const originalEnd = res.end.bind(res);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).end = (...args: unknown[]) => {
      const durationMs = Date.now() - start;
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${durationMs}ms`);
      }

      const correlationId =
        (res.getHeader(CORRELATION_ID_HEADER) as string | undefined) ??
        ((req as Request & { correlationId?: string }).correlationId) ??
        '-';
      this.logger.log(
        `[${correlationId}] ${req.method} ${req.url} ${res.statusCode} ${durationMs}ms`,
      );

      return originalEnd(...args);
    };

    next();
  }
}
