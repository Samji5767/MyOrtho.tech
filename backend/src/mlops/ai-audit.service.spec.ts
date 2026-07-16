import { AiAuditService } from './ai-audit.service';
import { PG_POOL } from '../database/database.module';
import { Test } from '@nestjs/testing';

const MOCK_ROW = {
  id: 'audit-1',
  organization_id: 'org-1',
  correlation_id: 'corr-123',
  model_id: null,
  model_name: 'copilot-assistant',
  model_version: '1.0',
  inference_type: 'copilot.chat',
  invoked_by: 'user-1',
  case_id: null,
  patient_id: null,
  input_hash: null,
  output_summary: null,
  latency_ms: null,
  tokens_used: null,
  confidence_score: null,
  outcome: null,
  disclaimer_shown: true,
  fallback_used: false,
  manual_review_required: false,
  audit_status: 'in_progress',
  error_code: null,
  created_at: new Date().toISOString(),
  completed_at: null,
};

function makePool(rows: unknown[][]) {
  let callIndex = 0;
  return { query: jest.fn(async () => ({ rows: rows[callIndex++] ?? [] })) };
}

describe('AiAuditService', () => {
  it('beginAudit creates an in_progress record', async () => {
    const pool = makePool([[MOCK_ROW]]);
    const module = await Test.createTestingModule({
      providers: [AiAuditService, { provide: PG_POOL, useValue: pool }],
    }).compile();

    const svc = module.get(AiAuditService);
    const result = await svc.beginAudit({
      organizationId: 'org-1',
      invokedBy: 'user-1',
      modelName: 'copilot-assistant',
      modelVersion: '1.0',
      inferenceType: 'copilot.chat',
      correlationId: 'corr-123',
      disclaimerShown: true,
    });

    expect(result.id).toBe('audit-1');
    expect(result.auditStatus).toBe('in_progress');
    expect(result.disclaimerShown).toBe(true);
    expect(result.fallbackUsed).toBe(false);

    const q = (pool.query as jest.Mock).mock.calls[0][0] as string;
    expect(q).toContain('in_progress');
  });

  it('finalizeAudit sets status to completed', async () => {
    const completedRow = { ...MOCK_ROW, audit_status: 'completed', latency_ms: 250, outcome: 'accepted', completed_at: new Date().toISOString() };
    const pool = makePool([[completedRow]]);
    const module = await Test.createTestingModule({
      providers: [AiAuditService, { provide: PG_POOL, useValue: pool }],
    }).compile();

    const svc = module.get(AiAuditService);
    const result = await svc.finalizeAudit('audit-1', { outcome: 'accepted', latencyMs: 250 });

    expect(result.auditStatus).toBe('completed');
    expect(result.latencyMs).toBe(250);
    expect(result.outcome).toBe('accepted');

    const q = (pool.query as jest.Mock).mock.calls[0][0] as string;
    expect(q).toContain('completed');
  });

  it('failAudit sets status to failed with error code', async () => {
    const pool = makePool([[]]); // no rows returned
    const module = await Test.createTestingModule({
      providers: [AiAuditService, { provide: PG_POOL, useValue: pool }],
    }).compile();

    const svc = module.get(AiAuditService);
    await svc.failAudit('audit-1', 'MODEL_UNAVAILABLE', 'Model returned 503');

    const [q, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]];
    expect(q).toContain('failed');
    expect(params[1]).toBe('MODEL_UNAVAILABLE');
  });

  it('beginAudit sets disclaimer_shown to true by default', async () => {
    const pool = makePool([[MOCK_ROW]]);
    const module = await Test.createTestingModule({
      providers: [AiAuditService, { provide: PG_POOL, useValue: pool }],
    }).compile();

    const svc = module.get(AiAuditService);
    await svc.beginAudit({
      organizationId: 'org-1',
      invokedBy: 'user-1',
      modelName: 'test',
      modelVersion: '1.0',
      inferenceType: 'test',
    });

    const params = (pool.query as jest.Mock).mock.calls[0][1] as unknown[];
    // disclaimerShown is the 13th parameter (index 12)
    expect(params[12]).toBe(true);
  });
});
