# Background Jobs System

MyOrtho.tech uses a PostgreSQL-backed background job queue for durable, org-isolated async work. The system provides at-least-once execution with atomic claiming, exponential retry, dead-lettering, and graceful shutdown.

## Architecture

```
background_jobs table (PostgreSQL)
         ↓  SELECT FOR UPDATE SKIP LOCKED
    WorkerService  (1 per process, configurable concurrency)
         ↓  resolves
    JobHandlerRegistry → typed handler → execute()
         ↓  result
    completeJob / scheduleRetry / failJob
```

## Status Machine

| Status | Meaning |
|--------|---------|
| `pending` | Ready to run at or after `run_at` |
| `running` | Claimed by a worker, lease active |
| `retry_scheduled` | Failed transiently, will retry at `retry_scheduled_at` |
| `completed` | Successfully finished, `result_json` populated |
| `failed` | Exceeded retry budget or non-retryable error |
| `dead_letter` | Non-retryable or max attempts exhausted — requires operator action |
| `cancelled` | Cancelled before execution started |

## Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `WORKER_ENABLED` | `true` | Set to `false` to disable polling (e.g. in test environments) |
| `WORKER_CONCURRENCY` | `3` | Max simultaneous jobs per process |

## Worker lifecycle

1. `onModuleInit` — starts poll loop and heartbeat timer, runs abandoned-job recovery once.
2. `poll()` — fires every 5 seconds; claims and dispatches up to `concurrency` jobs.
3. `heartbeat()` — fires every 30 seconds; renews `lease_expires_at` for all running jobs.
4. `recoverAbandonedJobs()` — at startup, resets `running` jobs whose lease expired > 2.5 minutes ago back to `pending`.
5. `onApplicationShutdown` — drains active jobs (up to 30-second grace period) before exit.

## Enqueuing Jobs (API)

```bash
POST /api/background-jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "jobType": "report.generate",
  "payloadJson": { "reportType": "clinical", "orgId": "..." },
  "priority": 5,
  "maxAttempts": 3,
  "runAt": "2024-01-15T10:00:00Z",
  "idempotencyKey": "report-org-jan-2024"
}
```

Idempotency keys are scoped per organization. A duplicate enqueue with the same key returns the existing job without creating a new one.

## Monitoring

```bash
GET /api/background-jobs/stats    # counts by status
GET /api/metrics                  # JSON (job queue + AI inference + worker)
GET /api/metrics/prometheus       # Prometheus text format
```

## Dead-Letter Recovery

When a job reaches `dead_letter` status, it requires manual intervention:

1. Review the job via `GET /api/background-jobs/:id`
2. Check the `error` and `last_error_code` fields
3. If the root cause is fixed, re-enqueue the job with `POST /api/background-jobs`
4. Cancel the dead-letter record with `POST /api/background-jobs/:id/cancel`

See [DEAD_LETTER_RECOVERY.md](./DEAD_LETTER_RECOVERY.md) for detailed procedures.
