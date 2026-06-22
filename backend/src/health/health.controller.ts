import { Controller, Get } from '@nestjs/common';

/**
 * Public, unauthenticated health endpoints for load balancers, container
 * orchestrators (Docker/Kubernetes liveness & readiness probes), and the
 * repository `scripts/health-check.sh`.
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  /** Liveness: the process is up and serving requests. */
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'myortho-backend',
      version: process.env.npm_package_version || '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness: the service has the configuration it needs to handle real
   * traffic. Returns `ready: false` (still HTTP 200) when required env is
   * missing or still set to placeholders, so orchestrators can gate rollout.
   */
  @Get('ready')
  getReadiness() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    const checks = {
      supabaseConfigured: Boolean(url && key && !url.includes('placeholder') && key !== 'placeholder'),
      databaseUrlSet: Boolean(process.env.DATABASE_URL),
    };
    const ready = Object.values(checks).every(Boolean);
    return {
      ready,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
