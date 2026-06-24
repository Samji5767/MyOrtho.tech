import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.on('error', (err: Error) => {
          // Log pool errors without crashing the process
          console.error('[PG Pool] Unexpected client error:', err.message);
        });
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
