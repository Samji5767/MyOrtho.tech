import { Logger } from '@nestjs/common';

const logger = new Logger('ConfigValidator');

interface ConfigCheck {
  key: string;
  required: boolean;
  secret?: boolean;
  description: string;
  default?: string;
}

const CONFIG_CHECKS: ConfigCheck[] = [
  { key: 'DATABASE_URL', required: true, secret: true, description: 'PostgreSQL connection string' },
  { key: 'JWT_SECRET', required: true, secret: true, description: 'JWT signing secret (min 32 chars)' },
  { key: 'ENCRYPTION_KEY', required: true, secret: true, description: 'AES-256-GCM key for PHI field encryption (32+ chars or 64 hex chars)' },
  { key: 'PORT', required: false, description: 'HTTP port', default: '4001' },
  { key: 'NODE_ENV', required: false, description: 'Runtime environment', default: 'development' },
  { key: 'SMTP_HOST', required: false, description: 'SMTP server (optional — email disabled if absent)' },
  { key: 'REDIS_URL', required: false, description: 'Redis URL (optional — caching disabled if absent)' },
  { key: 'LLM_API_KEY', required: false, secret: true, description: 'LLM API key (optional — rule-based fallback if absent)' },
];

export function validateConfig(): void {
  const missing: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  for (const check of CONFIG_CHECKS) {
    const value = process.env[check.key];
    if (!value) {
      if (check.required) {
        missing.push(`  ✗ ${check.key} — ${check.description}`);
      } else if (isProduction && !check.default) {
        warnings.push(`  ⚠ ${check.key} — ${check.description} (disabled)`);
      }
    } else {
      const display = check.secret ? `[set, ${value.length} chars]` : value;
      logger.log(`  ✓ ${check.key} = ${display}`);
    }
  }

  // JWT secret length check
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push('  ⚠ JWT_SECRET is shorter than 32 characters — increase entropy before production');
  }

  for (const w of warnings) {
    logger.warn(w);
  }

  if (missing.length > 0) {
    const msg = `\n\nMissing required configuration:\n${missing.join('\n')}\n\nSet these environment variables before starting.\n`;
    logger.error(msg);
    process.exit(1);
  }

  logger.log('Configuration validated successfully');
}
