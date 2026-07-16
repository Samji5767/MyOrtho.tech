import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async getHealth() {
    let dbOk = false;
    try {
      await this.pool.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }

    return {
      status: dbOk ? 'ok' : 'degraded',
      service: 'myortho-backend',
      version: process.env.npm_package_version || '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: { databaseConnected: dbOk },
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
    };
    const ready = checks.databaseUrlSet && checks.databaseConnected;

    if (!ready) {
      throw new HttpException(
        { ready: false, checks, timestamp: new Date().toISOString() },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { ready: true, checks, timestamp: new Date().toISOString() };
  }
}
