import { Logger } from '@nestjs/common';

const logger = new Logger('SlowQuery');
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS ?? '500', 10);

export async function withQueryTiming<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  if (elapsed > SLOW_QUERY_THRESHOLD_MS) {
    logger.warn(`Slow query [${elapsed}ms]: ${label}`);
  }
  return result;
}
