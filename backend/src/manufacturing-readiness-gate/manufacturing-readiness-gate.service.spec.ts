import { Test } from '@nestjs/testing';
import { ManufacturingReadinessGateService } from './manufacturing-readiness-gate.service';
import { PG_POOL } from '../database/database.module';

function makePool(queryMap: Record<string, { rows: unknown[] }>) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      for (const [key, val] of Object.entries(queryMap)) {
        if (sql.includes(key)) return Promise.resolve(val);
      }
      return Promise.resolve({ rows: [] });
    }),
  };
}

describe('ManufacturingReadinessGateService', () => {
  let svc: ManufacturingReadinessGateService;

  const ORG = 'org-1';
  const CASE = 'case-1';
  const PLAN = 'plan-1';

  async function build(queryMap: Record<string, { rows: unknown[] }>) {
    const pool = makePool(queryMap);
    const mod = await Test.createTestingModule({
      providers: [
        ManufacturingReadinessGateService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    svc = mod.get(ManufacturingReadinessGateService);
  }

  it('blocks when case not found', async () => {
    await build({ 'FROM cases': { rows: [] } });
    const result = await svc.evaluate(CASE, ORG, PLAN);
    expect(result.canQueue).toBe(false);
    expect(result.blockers.some((b) => b.code === 'CASE_NOT_FOUND')).toBe(true);
  });

  it('blocks when plan is not approved', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'approved' }] },
      'FROM treatment_plans WHERE id': {
        rows: [{ id: PLAN, doctor_approval: false, approved_at: null, estimated_stages: 24 }],
      },
    });
    const result = await svc.evaluate(CASE, ORG, PLAN);
    expect(result.canQueue).toBe(false);
    expect(result.blockers.some((b) => b.code === 'PLAN_NOT_APPROVED')).toBe(true);
  });

  it('blocks when no approved plan exists and no planId given', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'approved' }] },
      'FROM treatment_plans': { rows: [] },
    });
    const result = await svc.evaluate(CASE, ORG);
    expect(result.canQueue).toBe(false);
    expect(result.blockers.some((b) => b.code === 'NO_APPROVED_PLAN')).toBe(true);
  });

  it('blocks when simulated stages are present', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'approved' }] },
      'FROM treatment_plans WHERE id': {
        rows: [{ id: PLAN, doctor_approval: true, approved_at: new Date(), estimated_stages: 24 }],
      },
      'COUNT(*) AS cnt FROM aligner_stages': { rows: [{ cnt: '2' }] },
    });
    const result = await svc.evaluate(CASE, ORG, PLAN);
    expect(result.blockers.some((b) => b.code === 'SIMULATED_STAGES')).toBe(true);
  });

  it('blocks when no aligner stages exist', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'approved' }] },
      'FROM treatment_plans WHERE id': {
        rows: [{ id: PLAN, doctor_approval: true, approved_at: new Date(), estimated_stages: 24 }],
      },
      'COUNT(*) AS cnt FROM aligner_stages': { rows: [{ cnt: '0' }] },
      'FROM aligner_stages': { rows: [] },
    });
    const result = await svc.evaluate(CASE, ORG, PLAN);
    expect(result.blockers.some((b) => b.code === 'NO_STAGES')).toBe(true);
  });

  it('blocks when QA is rejected', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'approved' }] },
      'FROM treatment_plans WHERE id': {
        rows: [{ id: PLAN, doctor_approval: true, approved_at: new Date(), estimated_stages: 24 }],
      },
      'COUNT(*) AS cnt FROM aligner_stages': { rows: [{ cnt: '0' }] },
      'FROM aligner_stages': {
        rows: [
          { id: 's1', stage_number: 1, maxillary_mesh_path: '/m1.stl', mandibular_mesh_path: '/l1.stl' },
        ],
      },
      'FROM qa_inspections': { rows: [{ status: 'rejected' }] },
    });
    const result = await svc.evaluate(CASE, ORG, PLAN);
    expect(result.blockers.some((b) => b.code === 'QA_REJECTED')).toBe(true);
  });

  it('returns canQueue=true when all checks pass', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'approved' }] },
      'FROM treatment_plans WHERE id': {
        rows: [{ id: PLAN, doctor_approval: true, approved_at: new Date(), estimated_stages: 1 }],
      },
      'COUNT(*) AS cnt FROM aligner_stages': { rows: [{ cnt: '0' }] },
      'FROM aligner_stages': {
        rows: [
          { id: 's1', stage_number: 1, maxillary_mesh_path: '/m1.stl', mandibular_mesh_path: '/l1.stl' },
        ],
      },
      'FROM qa_inspections': { rows: [{ status: 'approved' }] },
      'FROM printers': { rows: [{ id: 'p1', status: 'online', connector_status: 'connected' }] },
    });
    const result = await svc.evaluate(CASE, ORG, PLAN);
    expect(result.canQueue).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});
