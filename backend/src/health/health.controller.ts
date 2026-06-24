import { Controller, Get, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

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

  @Get('ready')
  async getReadiness() {
    const databaseUrl = Boolean(process.env.DATABASE_URL);

    let dbConnected = false;
    if (databaseUrl) {
      try {
        await this.pool.query('SELECT 1');
        dbConnected = true;
      } catch {
        dbConnected = false;
      }
    }

    const checks = {
      databaseUrlSet: databaseUrl,
      databaseConnected: dbConnected,
      jwtSecretSet: Boolean(process.env.JWT_SECRET),
    };
    const ready = checks.databaseUrlSet && checks.databaseConnected;

    return { ready, checks, timestamp: new Date().toISOString() };
  }
}
