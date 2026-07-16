# Enterprise Operations Runbook

Operational procedures for MyOrtho.tech Enterprise 2.0 production environments.

## Health Checks

```bash
# API health
curl https://api.myortho.tech/health

# Worker status (requires admin token)
curl -H "Authorization: Bearer $TOKEN" https://api.myortho.tech/api/metrics

# Prometheus scrape endpoint
curl -H "Authorization: Bearer $TOKEN" https://api.myortho.tech/api/metrics/prometheus
```

## Background Worker

### Worker not processing jobs

1. Check `WORKER_ENABLED` env var — must not be `false` in production.
2. Check worker logs for `Poll error:` lines.
3. Check for running jobs with expired leases:
   ```sql
   SELECT COUNT(*) FROM background_jobs
   WHERE status = 'running' AND lease_expires_at < NOW();
   ```
   These will be recovered automatically at next startup via `recoverAbandonedJobs()`.

### High queue depth

```sql
SELECT job_type, status, COUNT(*) FROM background_jobs
WHERE status IN ('pending', 'retry_scheduled')
GROUP BY job_type, status
ORDER BY count DESC;
```

Scale horizontally by running additional worker processes. Each process independently claims jobs via `SELECT FOR UPDATE SKIP LOCKED` — no coordination needed.

### Jobs stuck in `running`

A job is stuck if its `lease_expires_at` has passed and no heartbeat was received. These are recovered automatically at worker startup. To trigger immediate recovery without restart:

```sql
UPDATE background_jobs
SET status = 'pending',
    worker_id = NULL, claimed_at = NULL,
    lease_expires_at = NULL, heartbeat_at = NULL,
    error = 'Manually recovered: lease expired',
    last_error_code = 'LEASE_EXPIRED',
    updated_at = NOW()
WHERE status = 'running'
  AND lease_expires_at < NOW() - interval '2.5 minutes';
```

## AI Inference Monitoring

```bash
# Check disclaimer compliance
curl -H "Authorization: Bearer $TOKEN" \
  https://api.myortho.tech/api/metrics/prometheus | grep disclaimer_rate
# Must be: myortho_ai_disclaimer_rate 1.0000
```

If disclaimer rate drops below 1.0:
1. Query `ai_inference_audit WHERE disclaimer_shown = FALSE` to find affected records.
2. Identify the inference path that bypassed the disclaimer.
3. Patch `AiAuditService.beginAudit()` to enforce `disclaimerShown = true` by default (it already does, so check for direct DB writes).

## Database Maintenance

### Apply pending migrations

```bash
for f in database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f" 2>&1 | grep -v "already exists"
done
```

All migrations are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). Safe to re-run.

### Dead-letter jobs accumulating

See [DEAD_LETTER_RECOVERY.md](./DEAD_LETTER_RECOVERY.md).

## Security

- All `/api/metrics` and `/api/metrics/prometheus` endpoints require `admin:settings` permission.
- Worker credentials: only `DATABASE_URL` is required. The worker uses the same pool as the API, scoped by org in all queries.
- PHI: never appears in job `payload_json`, `error`, `last_error_code`, or audit `input_metadata`. Enforce this in code review.

## Escalation

| Issue | Owner | SLA |
|-------|-------|-----|
| Dead-letter jobs | Backend on-call | 4 hours |
| Disclaimer rate < 100% | Clinical safety lead + Backend | Immediate |
| Integration `unhealthy` > 2 checks | Integration lead | 30 minutes |
| Worker not polling (queue depth growing) | Backend on-call | 1 hour |
