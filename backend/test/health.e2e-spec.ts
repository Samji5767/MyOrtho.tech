import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthController } from '../src/health/health.controller';
import { PG_POOL } from '../src/database/database.module';

/**
 * Scoped e2e test: boots only the HealthController with a mock pool so it
 * doesn't pull in the full AppModule (which would try to connect to DB).
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
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

  it('GET /health/ready reports readiness checks', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body).toHaveProperty('ready');
    expect(res.body.checks).toHaveProperty('databaseUrlSet');
    expect(res.body.checks).toHaveProperty('databaseConnected');
  });
});
