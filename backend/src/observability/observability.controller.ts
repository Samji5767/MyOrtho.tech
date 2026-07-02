import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@Controller()
@UseGuards(AuthGuard, PermissionsGuard)
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('metrics')
  @RequirePermission('admin:settings')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string {
    const m = this.observabilityService.getLiveSystemMetrics();
    return [
      `# HELP process_uptime_seconds Total process uptime in seconds`,
      `# TYPE process_uptime_seconds counter`,
      `process_uptime_seconds ${m.uptimeSeconds}`,
      ``,
      `# HELP http_requests_total Total number of HTTP requests handled since startup`,
      `# TYPE http_requests_total counter`,
      `http_requests_total ${m.totalRequests}`,
      ``,
      `# HELP api_response_time_ms Exponential moving average of HTTP response time in milliseconds`,
      `# TYPE api_response_time_ms gauge`,
      `api_response_time_ms ${m.apiResponseTimeMs}`,
      ``,
      `# HELP error_rate Fraction of requests that resulted in a 5xx status`,
      `# TYPE error_rate gauge`,
      `error_rate ${m.errorRate}`,
      ``,
      `# HELP cpu_load_percentage CPU load percentage (1-minute load average / core count)`,
      `# TYPE cpu_load_percentage gauge`,
      `cpu_load_percentage ${m.cpuLoadPercentage}`,
      ``,
      `# HELP heap_used_bytes Node.js heap memory used in bytes`,
      `# TYPE heap_used_bytes gauge`,
      `heap_used_bytes ${m.heapUsedBytes}`,
    ].join('\n');
  }
}
