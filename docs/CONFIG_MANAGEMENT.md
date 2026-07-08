# Configuration Management

## Environment Separation

| Variable | Development | Testing | Staging | Production |
|----------|-------------|---------|---------|------------|
| DATABASE_URL | Local PostgreSQL | Test DB / in-memory | Staging DB | Production DB |
| JWT_SECRET | `dev-secret` | `test-secret` | Rotated secret | Strong secret (32+ chars) |
| NODE_ENV | `development` | `test` | `staging` | `production` |
| SMTP_HOST | (disabled) | (disabled) | Optional | Configured |
| REDIS_URL | (disabled) | (disabled) | Optional | Configured |
| LLM_API_KEY | (disabled) | (disabled) | Optional | Configured |

## Safe Defaults

- SMTP not configured → email invite is suppressed with warning log (no crash)
- Redis not configured → caching disabled (requests always hit DB)
- LLM API key not set → AI copilot uses rule-based engine (fully functional)
- BUILD_DATE not set → reported as "unknown" in `/api/version`

## Config Validation

`validateConfig()` in `backend/src/common/config.validator.ts` runs at startup:
- Exits with code 1 if `DATABASE_URL` or `JWT_SECRET` are missing
- Logs warnings for missing optional services
- Checks JWT secret entropy (warns if < 32 chars)
- Never logs secret values — only lengths

## No Hardcoded Values

The following must NEVER appear in source code:
- Database credentials
- JWT secrets
- API keys
- SMTP passwords
- Internal hostnames or IPs

All are sourced from environment variables only.
