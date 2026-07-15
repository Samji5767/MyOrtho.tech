# Dead-Letter Queue Recovery

Jobs in `dead_letter` status require manual operator review. This document describes how to identify, diagnose, and recover dead-letter jobs.

## Identification

```bash
# View all dead-letter jobs for your org
GET /api/background-jobs?status=dead_letter

# Or via the admin UI: /admin/jobs (filter by Dead Letter)

# Direct DB query (ops use only)
SELECT id, job_type, error, last_error_code, attempts, updated_at
FROM background_jobs
WHERE status = 'dead_letter'
ORDER BY updated_at DESC;
```

## Common Error Codes

| `last_error_code` | Cause | Recovery |
|------------------|-------|---------|
| `UNKNOWN_JOB_TYPE` | No handler registered for `job_type` | Register the handler or correct the `job_type` and re-enqueue |
| `EXECUTION_ERROR` | Handler threw after exhausting retries | Fix the underlying system issue, then re-enqueue |
| `LEASE_EXPIRED` | Worker crashed mid-job; recovered from abandoned state | Job was reset to `pending` — no action needed unless it re-DLQs |

## Recovery Procedure

1. **Diagnose:** Read `error` and `last_error_code` from the job record.
2. **Fix root cause:** Address the external system failure (e.g., a downstream API outage, missing configuration).
3. **Re-enqueue:** Create a new job with the same `job_type` and `payload_json`.
   ```bash
   POST /api/background-jobs
   { "jobType": "...", "payloadJson": { ... } }
   ```
4. **Cancel the DLQ record:** Mark the original dead-letter job as cancelled.
   ```bash
   POST /api/background-jobs/:id/cancel
   ```

## Bulk Recovery (ops/DB)

If many jobs of the same type need recovery after a system fix:

```sql
-- Reset dead-letter jobs of a specific type back to pending
UPDATE background_jobs
SET status = 'pending',
    run_at = NOW(),
    attempts = 0,
    error = NULL,
    last_error_code = NULL,
    updated_at = NOW()
WHERE status = 'dead_letter'
  AND job_type = 'report.generate'
  AND organization_id = '<org-id>';
```

**Warning:** Only do this after confirming the root cause is fixed. Resetting without fixing will immediately re-DLQ the jobs.

## Alerting

Configure alerts when `myortho_background_jobs_total{status="dead_letter"} > 0`. Dead-letter jobs are always operator-actionable and should never accumulate silently.
