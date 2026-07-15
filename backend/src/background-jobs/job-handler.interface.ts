export interface JobHandler<TPayload = Record<string, unknown>, TResult = Record<string, unknown>> {
  readonly jobType: string;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  execute(jobId: string, payload: TPayload): Promise<TResult>;
  isRetryable(error: Error): boolean;
}

export interface JobExecutionContext {
  jobId: string;
  organizationId: string | null;
  jobType: string;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
}
