import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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
  app.enableCors();
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Backend is running on: http://localhost:${port}`);
}
bootstrap().catch(err => {
  console.error('Failed to bootstrap the backend application:', err);
  process.exit(1);
});
