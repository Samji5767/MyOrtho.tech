import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers — applied before any route handler
  app.use(
    helmet({
      // Allow the embedded Three.js canvas and inline scripts
      contentSecurityPolicy: false,
      // Allow cross-origin isolation for SharedArrayBuffer if needed for WASM
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );

  // Parse cookies before route handlers run (needed for mo_session auth cookie)
  app.use(cookieParser());

  // CORS: allow the configured frontend origin (production) plus localhost for dev.
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3005',
  ].filter(Boolean) as string[];
  app.enableCors({ origin: allowedOrigins, credentials: true });

  // Global input validation — strips unknown fields; transform coerces primitives.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
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
