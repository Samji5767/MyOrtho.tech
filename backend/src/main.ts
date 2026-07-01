import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

// ─── Startup validation ───────────────────────────────────────────────────────

function assertRequiredEnv(): void {
  const secret = process.env.JWT_SECRET ?? '';
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set to a string of at least 32 characters. ' +
      'Generate one with: openssl rand -hex 32',
    );
  }
  const encKey = process.env.ENCRYPTION_KEY ?? '';
  if (!encKey || encKey.length < 32) {
    console.warn(
      '[WARN] ENCRYPTION_KEY is not set or too short. ' +
      'PHI encryption will be degraded. Set before production launch.',
    );
  }
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (dbUrl.includes('CHANGE_ME_BEFORE_PRODUCTION')) {
    console.warn(
      '[WARN] DATABASE_URL contains the default development password. ' +
      'Set a strong POSTGRES_PASSWORD in your .env file before deploying to production.',
    );
  }
}

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );

  app.use(cookieParser());

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3005',
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      forbidUnknownValues: false,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Backend running on: http://localhost:${port}`);
}

bootstrap().catch(err => {
  console.error('Failed to bootstrap backend:', err);
  process.exit(1);
});
