# Security Review — Phase 28
> Audit date: 2026-07-01  
> Scope: Backend NestJS, FastAPI AI engine, Docker Compose, database schema

---

## 1. Authentication & authorization

| Control | Implementation | Status |
|---------|---------------|--------|
| JWT authentication | `AuthService.signToken()` / `verifyToken()` — HS256, expiry enforced | ✅ Implemented |
| JWT secret minimum length | `assertRequiredEnv()` rejects secrets shorter than 32 chars | ✅ Implemented |
| Auth guard on all routes | `@UseGuards(AuthGuard, PermissionsGuard)` on every controller | ✅ Verified |
| RBAC — 5 roles | `admin`, `orthodontist`, `assistant`, `patient`, `lab_technician` | ✅ Implemented |
| Permission decorators | `@RequirePermission('cases:write')` etc. per endpoint | ✅ Implemented |
| Rate limiting (auth) | In-memory fallback: 10 attempts/min per IP; Redis when available | ✅ Implemented |

---

## 2. Database security

| Control | Implementation | Status |
|---------|---------------|--------|
| Row-level security | 64 RLS policies across all tables | ✅ Implemented |
| Connection via pool | `pg.Pool` with env-var credentials — no hardcoded password | ✅ Verified |
| Default password detection | `main.ts:assertRequiredEnv()` warns on `CHANGE_ME_BEFORE_PRODUCTION` | ✅ Added (Phase 28) |
| Foreign key indexes | Migration 031 adds indexes on all FK columns | ✅ Implemented |
| SQL injection | Parameterized queries throughout (`$1`, `$2` placeholders) | ✅ Verified |
| Migrations run as separate service | `migrate` Docker service, not inline with app start | ✅ Docker Compose |

---

## 3. HTTP security headers

| Header | Value | Provided by |
|--------|-------|-------------|
| `X-Content-Type-Options` | `nosniff` | Helmet |
| `X-Frame-Options` | `DENY` | Helmet |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Helmet |
| `Content-Security-Policy` | Helmet default | Helmet |
| CORS | Whitelist from `ALLOWED_ORIGINS` env var | `main.ts` |

---

## 4. Secrets management

| Secret | Storage | Risk |
|--------|---------|------|
| `JWT_SECRET` | Environment variable | Low — not in source |
| `DATABASE_URL` | Environment variable | Low — not in source |
| `REDIS_URL` | Environment variable | Low — not in source |
| `STRIPE_SECRET_KEY` | Environment variable | Low — not in source |
| Docker Compose default password | `CHANGE_ME_BEFORE_PRODUCTION` in `docker-compose.yml` | **Medium** — developer must change before production deployment |

**Action required:** `docker-compose.yml` uses `CHANGE_ME_BEFORE_PRODUCTION` as the
fallback database password. A pre-deploy checklist must verify this is replaced with
a strong credential before any internet-facing deployment. The `assertRequiredEnv()`
check in `main.ts` will emit a `[WARN]` on startup if the default string is detected.

---

## 5. FastAPI AI engine

| Control | Status | Notes |
|---------|--------|-------|
| No auth on AI engine endpoints | **Gap** | `/segment`, `/landmarks`, `/predict-roots` are unauthenticated |
| Network isolation | AI engine is on internal Docker network | Partially mitigated |
| Input validation | Pydantic models on all request bodies | ✅ Implemented |
| Redis job store with in-memory fallback | Async job queue | ✅ Implemented |

**Required before production:** The AI engine should require a service-to-service
secret (e.g. `X-Internal-Token` header verified by the FastAPI app) so it cannot
be called directly from the internet. Currently only Docker network isolation prevents
external access.

---

## 6. HIPAA / PHI considerations

| Item | Status |
|------|--------|
| PHI stored in database | Patient name, DOB, case data — covered by RLS | Controlled |
| STL files | Not stored in this repo; must go through secure upload | Pending |
| Audit log | `case_audit_log` table with actor, IP, action | ✅ Implemented |
| Data at rest encryption | Depends on PostgreSQL host configuration | Not enforced by app |
| Data in transit | HTTPS enforced via HSTS header | ✅ Implemented |
| De-identification | Not implemented — any shared CBCT must be de-identified externally | Gap |

---

## 7. Summary of open security findings

| Severity | Finding | Recommendation |
|----------|---------|----------------|
| Medium | AI engine has no auth | Add service-to-service secret header |
| Medium | Docker Compose default password | Pre-deploy rotation checklist |
| Low | OpenSCAD not in Dockerfile | Add `apt-get install openscad` or use cloud boolean |
| Low | CBCT de-identification not automated | Add de-id pipeline before training data ingest |
| Info | Bolton analysis missing | Functional gap, not security |
