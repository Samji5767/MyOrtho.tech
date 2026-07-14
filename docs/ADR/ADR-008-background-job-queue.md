# ADR-008: Background Job Queue

**Status:** Accepted  
**Date:** 2026-07-14  
**Deciders:** Platform Engineering

---

## Context

Several platform operations are too slow or unreliable to run synchronously in an HTTP request: STL export packaging, CBCT analysis, batch QC scoring, email digest sending, analytics aggregation. Currently these are either run inline (causing timeouts) or triggered manually. There is no retry mechanism, no progress reporting, and no dead-letter queue for failed jobs.

## Decision

Implement a lightweight **PostgreSQL-backed background job queue** using the `background_jobs` table.

**Key design choices:**
- Jobs are persisted in PostgreSQL rather than a separate queue broker (Redis/RabbitMQ/SQS) to avoid new infrastructure dependencies at this stage.
- Priority field (1–10, lower = higher priority) allows urgent jobs (e.g., emergency protocol triggers) to preempt bulk analytics.
- `max_attempts` + `attempts` counter enables configurable retry policies per job type.
- Jobs that exhaust `max_attempts` transition to `dead_letter` status for manual investigation.
- `run_at` supports delayed/scheduled execution.
- `result_json` and `error` fields enable structured progress reporting without polling a separate status table.

**What this is NOT:**
- This is not a distributed job processor — no worker processes consume from this table yet. The table establishes the contract. Worker implementation (polling loop or LISTEN/NOTIFY) is a follow-on task.
- This does not replace Redis for caching or session management.

## Consequences

**Positive:**
- No new infrastructure required; jobs survive application restarts.
- Organization-scoped visibility: each org can see only its own jobs.
- System-level jobs (null `organization_id`) are supported for platform-wide operations.

**Negative:**
- Without a dedicated worker process, jobs sit in `pending` state until a worker is implemented. The table design is complete; the polling loop is a follow-on.
- High job throughput (>1000 jobs/min) would need to migrate to a proper queue broker.

## Alternatives Considered

- **BullMQ / Redis**: Production-grade, but requires Redis infrastructure and a separate worker process configuration.
- **AWS SQS**: Excellent durability, but introduces cloud vendor lock-in and networking complexity for on-premise VPS deployments.
- **Inline async execution**: Already the status quo; causes HTTP timeout issues for long-running jobs.
