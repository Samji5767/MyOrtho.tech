import { Global, Module, Logger } from '@nestjs/common';
import { Pool } from 'pg';

const logger = new Logger('DatabaseModule');

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          // Connection pool limits
          max: parseInt(process.env.PG_POOL_MAX ?? '20', 10),
          idleTimeoutMillis:      30_000,
          connectionTimeoutMillis: 5_000,
          // Statement timeout: no single query runs >30s
          statement_timeout:      30_000,
        });
        pool.on('error', (err: Error) => {
          logger.error(`Unexpected client error: ${err.message}`);
        });
        pool.on('connect', (client) => {
          // Apply session-level query timeout on every new connection
          void client.query('SET statement_timeout = 30000').catch(() => {});
        });
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
