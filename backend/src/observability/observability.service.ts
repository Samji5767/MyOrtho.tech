import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import * as api from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import * as os from 'os';

export interface TelemetryMetrics {
  uptimeSeconds: number;
  totalRequests: number;
  apiResponseTimeMs: number;
  errorRate: number;
  cpuLoadPercentage: number;
  heapUsedBytes: number;
}

@Injectable()
export class ObservabilityService implements OnApplicationShutdown {
  private readonly logger = new Logger(ObservabilityService.name);
  private sdk: NodeSDK | null = null;
  private tracer: api.Tracer;

  // Real counters updated by TimingMiddleware on every request
  private totalRequests = 0;
  private errorRequests = 0;
  private emaResponseTimeMs = 0;
  private readonly EMA_ALPHA = 0.1;

  constructor() {
    this.logger.log('Initializing OpenTelemetry instrumentation SDK...');
    try {
      const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      const serviceName = process.env.OTEL_SERVICE_NAME ?? 'myortho-backend';
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        'deployment.environment': process.env.NODE_ENV ?? 'development',
      });

      if (otlpEndpoint) {
        const traceExporter = new OTLPTraceExporter({
          url: otlpEndpoint.endsWith('/v1/traces')
            ? otlpEndpoint
            : `${otlpEndpoint}/v1/traces`,
        });
        this.sdk = new NodeSDK({ resource, traceExporter });
        this.logger.log(
          `OpenTelemetry OTLP export enabled → ${otlpEndpoint}/v1/traces (service: ${serviceName})`,
        );
      } else {
        this.sdk = new NodeSDK({ resource });
        this.logger.warn(
          'OTEL_EXPORTER_OTLP_ENDPOINT is not set — trace export is disabled. ' +
          'Set this env var to enable OTLP tracing (e.g. http://otel-collector:4318).',
        );
      }

      this.sdk.start();
      this.logger.log('OpenTelemetry SDK started.');
    } catch (e) {
      this.logger.error('Failed to start OpenTelemetry NodeSDK, running without tracing:', e);
    }
    this.tracer = api.trace.getTracer('myortho-backend-service');
  }

  async onApplicationShutdown() {
    this.logger.log('Shutting down OpenTelemetry SDK...');
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.logger.log('OpenTelemetry SDK shut down successfully.');
      } catch (err) {
        this.logger.error('Error shutting down OpenTelemetry SDK:', err);
      }
    }
  }

  /**
   * Called by TimingMiddleware on every completed request.
   * Maintains an exponential moving average of response times and a real error rate.
   */
  recordRequest(durationMs: number, isError: boolean): void {
    this.totalRequests++;
    if (isError) this.errorRequests++;
    if (this.totalRequests === 1) {
      this.emaResponseTimeMs = durationMs;
    } else {
      this.emaResponseTimeMs =
        this.emaResponseTimeMs * (1 - this.EMA_ALPHA) + durationMs * this.EMA_ALPHA;
    }
  }

  /**
   * Tracks a distributed trace path span across microservice boundaries.
   */
  async trackTraceSpan(traceId: string, spanName: string, actionFn: () => Promise<any>): Promise<any> {
    const formattedTraceId = this.formatTraceIdForOtel(traceId);
    const formattedSpanId = this.generateSpanId();

    const spanContext = traceId
      ? api.trace.setSpanContext(api.context.active(), {
          traceId: formattedTraceId,
          spanId: formattedSpanId,
          traceFlags: api.TraceFlags.SAMPLED,
        })
      : api.context.active();

    return this.tracer.startActiveSpan(spanName, {}, spanContext, async (span) => {
      span.setAttribute('trace.id', traceId);
      span.setAttribute('myortho.operation', spanName);

      const start = Date.now();
      this.logger.log(`[OTEL TRACE START] Span: ${spanName} TraceId: ${traceId}`);
      try {
        const result = await actionFn();
        const duration = Date.now() - start;
        this.logger.log(`[OTEL TRACE COMPLETED] Span: ${spanName} TraceId: ${traceId} Duration: ${duration}ms`);
        span.setStatus({ code: api.SpanStatusCode.OK });
        return result;
      } catch (err) {
        this.logger.error(`[OTEL TRACE ERROR] Span: ${spanName} TraceId: ${traceId} Message: ${err.message}`);
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: err.message,
        });
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Returns real operational metrics — no simulated values.
   * Response time and error rate are derived from actual request counters
   * maintained by TimingMiddleware. CPU and heap come directly from the OS/process.
   */
  getLiveSystemMetrics(): TelemetryMetrics {
    const cpus = os.cpus();
    const numCpus = cpus ? cpus.length : 1;
    const loadAvg = os.loadavg();
    const rawCpuPercent = loadAvg && loadAvg[0] ? (loadAvg[0] / numCpus) * 100 : 0;
    const cpuLoadPercentage = Math.min(100, Math.max(0, Math.floor(rawCpuPercent)));
    const memoryUsage = process.memoryUsage();

    return {
      uptimeSeconds: Math.floor(process.uptime()),
      totalRequests: this.totalRequests,
      apiResponseTimeMs: Math.round(this.emaResponseTimeMs),
      errorRate:
        this.totalRequests > 0
          ? parseFloat((this.errorRequests / this.totalRequests).toFixed(5))
          : 0,
      cpuLoadPercentage,
      heapUsedBytes: memoryUsage.heapUsed,
    };
  }

  private formatTraceIdForOtel(traceId: string): string {
    const clean = traceId.replace(/[^a-fA-F0-9]/g, '');
    if (clean.length === 32) return clean;
    if (clean.length > 32) return clean.substring(0, 32);
    let result = clean;
    while (result.length < 32) {
      result += '0';
    }
    return result;
  }

  private generateSpanId(): string {
    // OTel span IDs must be 16 hex chars; use crypto-quality randomness when available
    try {
      return require('crypto').randomBytes(8).toString('hex');
    } catch {
      return Date.now().toString(16).padStart(16, '0');
    }
  }
}
