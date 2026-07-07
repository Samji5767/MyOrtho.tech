import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { LoggingInterceptor } from './common/logging.interceptor';

const logger = new Logger('Bootstrap');

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
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_KEY must be set to at least 32 characters in production. ' +
        'Generate one with: openssl rand -hex 32',
      );
    }
    logger.warn(
      'ENCRYPTION_KEY is not set or too short. ' +
      'PHI encryption will be degraded. Set before production launch.',
    );
  }
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (dbUrl.includes('CHANGE_ME_BEFORE_PRODUCTION')) {
    logger.warn(
      'DATABASE_URL contains the default development password. ' +
      'Set a strong POSTGRES_PASSWORD in your .env file before deploying to production.',
    );
  }
  const adminPw = process.env.MYORTHO_ADMIN_PASSWORD ?? '';
  if (!adminPw) {
    throw new Error(
      'MYORTHO_ADMIN_PASSWORD must be set. ' +
      'Generate one with: openssl rand -base64 24',
    );
  }
  const frontendUrl = process.env.FRONTEND_URL ?? '';
  if (!frontendUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FRONTEND_URL must be set in production. ' +
        'Example: FRONTEND_URL=https://app.myortho.tech',
      );
    }
    logger.warn('FRONTEND_URL not set — CORS will only allow localhost origins.');
  }
}

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security headers
  app.use(
    helmet({
      // CSP: restrict sources; allow same-origin + Stripe/Supabase for SaaS features.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: [
            "'self'",
            "https://*.supabase.co",
            "https://api.stripe.com",
          ],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.use(cookieParser());

  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    ...(!isProduction ? ['http://localhost:3000', 'http://localhost:3005'] : []),
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
      // Reject requests that include properties not declared in the DTO.
      // Prevents mass-assignment attacks on all endpoints.
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`Backend running on: http://localhost:${port}`);
}

bootstrap().catch(err => {
  logger.error('Failed to bootstrap backend:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
