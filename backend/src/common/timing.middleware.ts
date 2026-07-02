import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { ObservabilityService } from '../observability/observability.service';

@Injectable()
export class TimingMiddleware implements NestMiddleware {
  constructor(private readonly observabilityService: ObservabilityService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const originalEnd = res.end.bind(res);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).end = (...args: unknown[]) => {
      const durationMs = Date.now() - start;
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${durationMs}ms`);
      }
      this.observabilityService.recordRequest(durationMs, res.statusCode >= 500);
      return originalEnd(...args);
    };

    next();
  }
}
