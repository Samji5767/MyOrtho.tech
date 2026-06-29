import { Global, Module, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const logger = new Logger('RedisModule');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis | null => {
        const url = process.env.REDIS_URL;
        if (!url) {
          logger.warn('REDIS_URL not set — Redis features will use in-memory fallback');
          return null;
        }
        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
          lazyConnect: true,
        });
        client.on('error', (err: Error) => {
          logger.error(`Redis client error: ${err.message}`);
        });
        client.on('connect', () => {
          logger.log('Redis connected');
        });
        client.connect().catch((err: Error) => {
          logger.warn(`Redis connection failed (falling back to in-memory): ${err.message}`);
        });
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
