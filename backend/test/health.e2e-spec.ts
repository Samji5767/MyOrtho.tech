import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthController } from '../src/health/health.controller';

/**
 * Scoped e2e test: boots only the HealthController so it doesn't pull in the
 * full AppModule (which would try to connect to Supabase/DB during tests).
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
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
    expect(res.body.checks).toHaveProperty('supabaseConfigured');
    expect(res.body.checks).toHaveProperty('databaseUrlSet');
  });

  it('reports not-ready when Supabase is a placeholder', async () => {
    const prevUrl = process.env.SUPABASE_URL;
    process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body.checks.supabaseConfigured).toBe(false);
    process.env.SUPABASE_URL = prevUrl;
  });
});
