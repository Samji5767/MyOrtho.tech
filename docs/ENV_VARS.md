# Environment Variables

## Backend — Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/myortho` |
| `JWT_SECRET` | JWT signing secret (minimum 32 characters) | `your-very-long-secret-here` |
| `PORT` | Backend HTTP port | `4001` |

## Backend — Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `REDIS_URL` | Redis connection string (caching, sessions) | disabled |
| `LLM_API_KEY` | LLM provider API key (enables AI RAG responses) | disabled |
| `SMTP_HOST` | SMTP server hostname (enables email delivery) | disabled |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP authentication username | — |
| `SMTP_PASS` | SMTP authentication password | — |
| `SMTP_SECURE` | Use TLS (`true`/`false`) | `false` |
| `SMTP_FROM` | Sender address for outgoing emails | `noreply@myortho.tech` |

## Frontend

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `https://api.myortho.tech` |

## Notes

- All secrets must be rotated before first production deployment.
- `JWT_SECRET` must be at least 32 random characters. Generate with: `openssl rand -base64 32`
- SMTP is optional — if not configured, invite emails are suppressed with a warning log.
- `LLM_API_KEY` is optional — copilot falls back to rule-based responses if not set.
