import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthController } from '../src/health/health.controller';
import { PG_POOL } from '../src/database/database.module';

/**
 * Scoped e2e test: boots only the HealthController with a mock pool so it
 * doesn't pull in the full AppModule (which would try to connect to DB).
 *
 * Two scenarios:
 *  - healthy pool (SELECT 1 resolves)  → /health/ready returns 200
 *  - failing pool (SELECT 1 rejects)   → /health/ready returns 503
 */
describe('Health (e2e)', () => {
  describe('when database is reachable', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.DATABASE_URL = 'postgres://test';
      const mockPool = { query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) };

      const moduleRef = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: PG_POOL, useValue: mockPool }],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns ok with metadata', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('myortho-backend');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });

    it('GET /health/ready returns 200 when database is up', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.checks).toHaveProperty('databaseUrlSet');
      expect(res.body.checks).toHaveProperty('databaseConnected');
    });
  });

  describe('when database is unreachable', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.DATABASE_URL = 'postgres://test';
      const failingPool = { query: jest.fn().mockRejectedValue(new Error('connection refused')) };

      const moduleRef = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: PG_POOL, useValue: failingPool }],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health/ready returns 503 when database is down', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
      expect(res.body.ready).toBe(false);
      expect(res.body.checks.databaseConnected).toBe(false);
    });
  });
});
