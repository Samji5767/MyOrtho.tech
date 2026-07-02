# Phase O — Operations & Observability Report

**Date**: 2026-07-02  
**Branch**: `claude/myortho-production-validation-dlmvsi`  
**Method**: Source code audit of health endpoints, observability service, Docker Compose config, migration scripts, and logging configuration.

---

## O1 — Health Endpoints

### `GET /health`

Always returns HTTP 200 with `{ status: 'ok', ... }` regardless of dependency state.  
Does not check: database connectivity, Redis availability, AI engine reachability.

```typescript
@Get()
getHealth() {
  return { status: 'ok', service: 'myortho-backend', ... };
}
```

**Finding (O1-F1)**: This endpoint is suitable for a liveness check (process is alive) but not a readiness check (dependencies healthy). Kubernetes/ECS liveness probes that rely on this endpoint will never trigger a restart on database outage.

### `GET /health/ready`

Checks: `DATABASE_URL` env var is set AND `SELECT 1` succeeds.  
Does not check: Redis connectivity, JWT secret validity, AI engine health.

```typescript
const ready = checks.databaseUrlSet && checks.databaseConnected;
return { ready, checks, ... };
```

**Finding (O1-F2)**: Readiness endpoint always returns HTTP 200, even when `ready: false`. A load balancer or Kubernetes readiness probe expecting HTTP 503 on unready will not correctly remove the pod from rotation on database outage.

**Finding (O1-F3)**: No `/metrics` endpoint in Prometheus format. Metrics are available only via `GET /api/observability/metrics` (JSON), not scrapable by Prometheus/Grafana.

---

## O2 — Metrics and Observability

### Real counters (confirmed working)

`ObservabilityService` maintains:
- `totalRequests` — incremented on every request via `TimingMiddleware`
- `errorRequests` — incremented on 4xx/5xx responses
- `emaResponseTimeMs` — exponential moving average (α=0.1) updated per request

`TimingMiddleware` patches `res.end` to capture wall-clock duration on response completion.

`X-Response-Time` header is returned on all responses with the actual duration in ms.

### OpenTelemetry (NOT functional)

```typescript
this.sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'myortho-backend' }),
  // No SpanExporter configured
});
```

No exporter is configured. All `tracer.startActiveSpan()` calls run but emit to the no-op trace provider. No spans reach Jaeger, Tempo, OTLP, or any cloud trace backend. This means:
- Distributed traces cannot be correlated across backend → AI engine
- Request latency attribution is unavailable per-service
- Error traces cannot be inspected in a trace UI

**Finding (O2-F1)**: OpenTelemetry SDK is initialized but produces no observable output. The infrastructure is wired; a single `OTLPTraceExporter` or `JaegerExporter` would activate it.

### CPU and heap metrics

`getLiveSystemMetrics()` reads `os.loadavg()[0]` and `process.memoryUsage().heapUsed` — real OS values, not simulated.

---

## O3 — Logging

`AllExceptionsFilter` structured logging:
- 5xx errors: logged with full stack trace server-side via NestJS `Logger`
- Client responses: sanitized `{ statusCode, message, timestamp, path }`
- No structured JSON format configured for log aggregation (ELK, Loki, CloudWatch)

AI engine structured logging:
- All auth decisions logged as JSON to stdout
- Request/response cycle not logged

**Finding (O3-F1)**: No centralized log aggregation configuration exists. Logs go to container stdout only. Without a sidecar (Fluent Bit, Filebeat) or log driver (`awslogs`, `gcplogs`), logs are lost on container restart.

**Finding (O3-F2)**: Application logs are not in JSON format — they use NestJS default colorized text format. This makes machine parsing unreliable in aggregation pipelines.

---

## O4 — Container Configuration (docker-compose.yml)

### Critical issues

| Issue | Finding |
|-------|---------|
| No restart policy | `backend`, `frontend`, `ai-engine` services have no `restart: unless-stopped`. On process crash, containers stay down until manual intervention. |
| No resource limits | No `mem_limit`, `cpus`, or `deploy.resources` configured. An OOM in the AI engine will consume all available host memory. |
| `npm install` instead of `npm ci` | Dockerfiles use `npm install` which ignores `package-lock.json` version pins. Production builds may differ from CI builds. |
| Containers run as root | No `USER` directive in any Dockerfile (documented in Phase N). |
| Redis memory limit | `--maxmemory 256mb --maxmemory-policy allkeys-lru` configured — **GOOD**. |

### DB migration script gap

`docker-compose.yml` uses `./database/migrate.sh` (no migration tracking table — runs all migrations on every startup) rather than `./scripts/migrate.sh` (has `schema_migrations` tracking table to apply each migration only once). On every container restart, all 033 migration files re-execute. Idempotent migrations (using `IF NOT EXISTS`) will not double-apply, but non-idempotent ones risk failure.

---

## O5 — Backup and Disaster Recovery

**Status: Not implemented.**

| Item | Status |
|------|--------|
| Automated PostgreSQL backups | Not found in any config file |
| Backup retention policy | Not defined |
| Point-in-time recovery (PITR) | Not configured |
| WAL archiving | Not configured |
| Backup verification procedure | Not defined |
| Recovery time objective (RTO) | Not defined |
| Recovery point objective (RPO) | Not defined |
| DR runbook | Not found |

**Finding (O5-F1)**: No backup mechanism for PostgreSQL exists in the codebase or deployment config. Production data loss on disk failure is unmitigated.

---

## O6 — Alerting

**Status: Not implemented.**

No PagerDuty, OpsGenie, Slack webhook, or email alert integration exists. No alert rules are defined for:
- Service downtime (no health check alert)
- High error rate (no threshold monitoring)
- Database connection pool exhaustion
- Disk usage on scan uploads
- Redis memory pressure

---

## O7 — Secret Management

All secrets are provided via environment variables from `.env` file. No integration with HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, or Azure Key Vault.

`.env` contains plaintext secrets (`JWT_SECRET`, `DATABASE_URL`, `STRIPE_SECRET_KEY`). The `.gitignore` correctly excludes `.env` from git tracking.

**Finding (O7-F1)**: `.env.example` exists but does not document `INTERNAL_API_SECRET` or `UPLOADS_DIR` (documented in Phase N).

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Liveness endpoint | PARTIAL | Returns 200 always; no dependency checks |
| Readiness endpoint | PARTIAL | Returns 200 even when ready=false (no HTTP 503) |
| Prometheus metrics | NOT IMPLEMENTED | JSON endpoint only |
| Request counters | REAL | EMA response time, total requests, error rate |
| X-Response-Time header | PASS | All responses |
| OpenTelemetry | NOT FUNCTIONAL | SDK initialized; no exporter |
| Structured logging | PARTIAL | Text format; no JSON for aggregation |
| Container restart policy | MISSING | No `restart: unless-stopped` |
| Resource limits | MISSING | No mem/CPU limits |
| npm ci in Dockerfile | NOT USED | `npm install` used instead |
| Containers as root | FAIL | No USER directive |
| Migration tracking | GAP | migrate.sh re-runs all migrations on restart |
| Automated backups | NOT IMPLEMENTED | No backup config |
| DR / RTO / RPO | NOT DEFINED | No runbook |
| Alerting | NOT IMPLEMENTED | No alert integrations |
| Secret management | `.env` only | No vault integration |

**Operations Readiness Score**: 42/100  
Rationale: Real metrics and response-time middleware work correctly. Everything beyond the running process is a gap: no functional tracing, no alerting, no backups, no DR, containers restart manually on crash. These are production-blocking gaps for a healthcare application.
