import { Controller, Get, Header } from '@nestjs/common';
import { ObservabilityService } from './observability.service';

@Controller()
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string {
    const metrics = this.observabilityService.getLiveSystemMetrics();
    return [
      `# HELP active_sessions Current number of active user sessions`,
      `# TYPE active_sessions gauge`,
      `active_sessions ${metrics.activeSessions}`,
      ``,
      `# HELP api_response_time_ms Average API response time in milliseconds`,
      `# TYPE api_response_time_ms gauge`,
      `api_response_time_ms ${metrics.apiResponseTimeMs}`,
      ``,
      `# HELP error_rate Current error rate`,
      `# TYPE error_rate gauge`,
      `error_rate ${metrics.errorRate}`,
      ``,
      `# HELP cpu_load_percentage CPU load percentage`,
      `# TYPE cpu_load_percentage gauge`,
      `cpu_load_percentage ${metrics.cpuLoadPercentage}`,
      ``,
      `# HELP heap_used_bytes Memory heap used in bytes`,
      `# TYPE heap_used_bytes gauge`,
      `heap_used_bytes ${metrics.heapUsedBytes}`,
    ].join('\n');
  }
}
