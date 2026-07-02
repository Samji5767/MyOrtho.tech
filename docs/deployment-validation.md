# Deployment Validation — Phase 28
> Audit date: 2026-07-01

---

## 1. Docker Compose service map

| Service | Role | Health check | Depends on |
|---------|------|-------------|------------|
| `database` | PostgreSQL 16 | `pg_isready` | — |
| `redis` | Redis 7 | `redis-cli ping` | — |
| `migrate` | Runs DB migrations (`restart: "no"`) | — | `database` (healthy) |
| `backend` | NestJS API | `curl /health` | `database`, `redis` (healthy) |
| `frontend` | Next.js | `curl /` | `backend` (healthy) |
| `ai-engine` | FastAPI | `curl /health` | `database`, `redis` (healthy) |

**Result:** `docker compose config` validates with no errors (only a harmless `version` key deprecation warning).

---

## 2. Health check verification

All services with persistent connections expose health endpoints that Docker monitors.
The `migrate` service uses `restart: "no"` — if migrations fail the container exits
with a non-zero code, blocking dependent services via the `depends_on: condition: service_healthy`
chain.

---

## 3. Database migration safety

| Property | Status |
|----------|--------|
| Migration files | 33 sequential files in `backend/migrations/` |
| Migration runner | `node-pg-migrate` via dedicated `migrate` service |
| Idempotent UP | All migrations use `IF NOT EXISTS` / `IF NOT EXISTS` guards |
| Rollback (DOWN) | Not all migrations have `DOWN` blocks — manual rollback required for some |
| FK indexes | Migration 031 adds missing FK indexes |
| RLS policies | 64 policies applied in migrations |

**Gap:** Approximately 8 of 33 migration files do not define a `DOWN` migration.
This means automated rollback via `node-pg-migrate down` would partially succeed.
Manual rollback procedures should be documented before production.

---

## 4. Volume persistence

Named volumes ensure data survives container restarts:
- `postgres_data` — database files
- `redis_data` — Redis persistence (if AOF/RDB configured)
- (No volume for frontend build artefacts — rebuilt on container start)

---

## 5. Environment variable checklist

The following env vars must be set before production deployment. The backend
`assertRequiredEnv()` validates these at startup:

| Variable | Validated at startup | Notes |
|----------|---------------------|-------|
| `DATABASE_URL` | Yes — warns on default password | Required |
| `JWT_SECRET` | Yes — rejects < 32 chars | Required |
| `REDIS_URL` | Yes | Required |
| `ALLOWED_ORIGINS` | Yes | CORS whitelist |
| `STRIPE_SECRET_KEY` | If billing enabled | Optional for dev |
| `SUPABASE_URL` | If Supabase used | Optional |

---

## 6. Open gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Missing DOWN migrations | Medium | Manual rollback only for 8 migrations |
| OpenSCAD not in ai-engine Dockerfile | Medium | Hollowing silently skipped |
| No migration lock | Low | Concurrent migration runs possible in multi-replica deploy |
| `version` key in docker-compose.yml | Info | Deprecated, harmless — can be removed |
