import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  console.log('Validating Supabase environment variables...');
  if (!url || !key || url.includes('placeholder') || key === 'placeholder') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'PRODUCTION ERROR: Supabase URL and Anon Key must be configured and cannot be placeholders!'
      );
    } else {
      console.warn(
        'WARNING: Supabase URL or Anon Key is missing or set to placeholder. Backend will fallback to mock configurations in development.'
      );
    }
  }

  const app = await NestFactory.create(AppModule);

  // CORS: allow the configured frontend origin (production) plus localhost for dev.
  // Wildcard was removed to prevent cross-site request forgery in production.
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3005',
  ].filter(Boolean) as string[];
  app.enableCors({ origin: allowedOrigins, credentials: true });

  // Global input validation — strips unknown fields; transform coerces primitives.
  // forbidNonWhitelisted is intentionally absent: several controllers still use
  // untyped @Body() dto: any, which has no class-validator metadata at runtime.
  // With forbidNonWhitelisted those endpoints would silently reject valid requests.
  // Re-enable once all controllers have decorated DTO classes.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Backend is running on: http://localhost:${port}`);
}
bootstrap().catch(err => {
  console.error('Failed to bootstrap the backend application:', err);
  process.exit(1);
});
