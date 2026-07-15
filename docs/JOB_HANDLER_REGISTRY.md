# Job Handler Registry

The `JobHandlerRegistry` maps job type strings to typed handler instances. It is registered as a NestJS injectable in `BackgroundJobsModule`.

## Built-in Handlers

| Job Type | Timeout | Max Attempts | Retryable |
|----------|---------|--------------|-----------|
| `integration.health_check` | 30 s | 3 | Yes (all errors) |
| `report.generate` | 120 s | 2 | Yes (all errors) |
| `cleanup.expired_files` | 300 s | 2 | Yes (all errors) |
| `ai.segmentation` | 600 s | 2 | Yes (all errors) |

## Handler Interface

```typescript
interface JobHandler<TPayload, TResult> {
  readonly jobType: string;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  execute(jobId: string, payload: TPayload): Promise<TResult>;
  isRetryable(error: Error): boolean;
}
```

## Registering a Custom Handler

```typescript
// my-handler.ts
import { JobHandler } from '../background-jobs/job-handler.interface';

export class MyHandler implements JobHandler {
  readonly jobType = 'my.custom_job';
  readonly timeoutMs = 60_000;
  readonly maxAttempts = 3;

  async execute(jobId: string, payload: Record<string, unknown>) {
    // ... do work ...
    return { done: true };
  }

  isRetryable(error: Error): boolean {
    return !error.message.includes('INVALID_INPUT');
  }
}
```

```typescript
// In JobHandlerRegistry constructor:
this.register(new MyHandler());
```

## Error Classification

`isRetryable(error)` determines whether a failed job is eligible for retry:
- Return `true` — transient failure (network, timeout, temporary unavailability). Job is rescheduled with exponential backoff.
- Return `false` — permanent failure (bad input, unknown job type). Job goes directly to `dead_letter`.

## Backoff Schedule

Retry delay = `min(1000ms × 2^attempt, 300_000ms)`:

| Attempt | Delay |
|---------|-------|
| 1 | 2 s |
| 2 | 4 s |
| 3 | 8 s |
| 4 | 16 s |
| 5+ | 5 min (cap) |
