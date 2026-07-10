# Deployment Guide — MyOrtho 2.0 RC1

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Docker | 24.x |
| Docker Compose | v2.x |
| CPU | 4 cores |
| RAM | 8 GB (16 GB recommended for AI engine) |
| Disk | 50 GB SSD |
| OS | Ubuntu 22.04 LTS or Debian 12 |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in every value. The application will refuse to start if any required variable is missing.

### Required

```
# Database
DATABASE_URL=postgresql://myortho:<STRONG_PASSWORD>@postgres:5432/myortho
POSTGRES_PASSWORD=<STRONG_PASSWORD>       # min 16 chars, no default

# Authentication
JWT_SECRET=<64-char random hex>           # openssl rand -hex 32
MYORTHO_ADMIN_EMAIL=admin@yourorg.com
MYORTHO_ADMIN_PASSWORD=<min 12 chars>     # openssl rand -base64 16

# Frontend
FRONTEND_URL=https://app.yourorg.com      # required in production

# Encryption
ENCRYPTION_KEY=<64-char hex>              # openssl rand -hex 32
```

### Optional but recommended

```
# Redis (session blacklist + rate limiting)
REDIS_URL=redis://redis:6379

# Email
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=notifications@yourorg.com
SMTP_PASS=<smtp password>
SMTP_FROM=MyOrtho <notifications@yourorg.com>

# AI engine
TREATMENT_PLAN_AI_URL=http://ai-engine:8000
MODEL_CHECKPOINT=/models/ortho_seg_v1.pth   # required for real inference

# Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Storage
STORAGE_PATH=/data/uploads               # must be a persistent volume
```

---

## First Deployment

```bash
# 1. Clone repository
git clone https://github.com/Samji5767/MyOrtho.tech.git
cd MyOrtho.tech

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Start all services
docker compose up -d

# 4. Verify health
curl http://localhost:3001/api/health
curl http://localhost:8000/health

# 5. Access the app
open http://localhost:3000
```

The backend creates the database schema and seeds the admin account on first boot.

---

## Production Checklist

- [ ] `NODE_ENV=production` is set in the backend container
- [ ] `FRONTEND_URL` matches the public HTTPS URL exactly (no trailing slash)
- [ ] `JWT_SECRET` is ≥ 32 characters
- [ ] `ENCRYPTION_KEY` is a 64-char hex string
- [ ] `MYORTHO_ADMIN_PASSWORD` is ≥ 12 characters and stored in a secrets manager
- [ ] Redis is running (in-memory fallback works but does not persist across restarts)
- [ ] `STORAGE_PATH` is a persistent volume (not a container-local path)
- [ ] TLS termination is in place upstream (nginx, Caddy, load balancer)
- [ ] `secure` cookie flag is active — requires HTTPS in production
- [ ] `MODEL_CHECKPOINT` path is set and the file exists for real AI inference

---

## Updating

```bash
git pull origin main
docker compose pull
docker compose up -d --no-deps --build backend frontend ai-engine
```

No schema migration scripts are required for RC1 → GA unless noted in RELEASE_NOTES.md.

---

## Logs

```bash
docker compose logs -f backend     # NestJS structured JSON
docker compose logs -f ai-engine   # FastAPI/uvicorn
docker compose logs -f frontend    # Next.js
```

---

## Stopping

```bash
docker compose down        # stops containers, preserves volumes
docker compose down -v     # DESTROYS all data — use only for complete reset
```
