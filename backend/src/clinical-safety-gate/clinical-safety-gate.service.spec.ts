import { Test } from '@nestjs/testing';
import { ClinicalSafetyGateService } from './clinical-safety-gate.service';
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

describe('ClinicalSafetyGateService', () => {
  let svc: ClinicalSafetyGateService;
  let pool: ReturnType<typeof makePool>;

  const ORG = 'org-1';
  const CASE = 'case-1';
  const PLAN = 'plan-1';

  async function build(queryMap: Record<string, { rows: unknown[] }>) {
    pool = makePool(queryMap);
    const mod = await Test.createTestingModule({
      providers: [
        ClinicalSafetyGateService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();
    svc = mod.get(ClinicalSafetyGateService);
  }

  it('blocks when case does not exist in org', async () => {
    await build({ 'FROM cases': { rows: [] } });
    const result = await svc.evaluate(CASE, ORG);
    expect(result.canApprove).toBe(false);
    expect(result.blockers.some((b) => b.code === 'CASE_NOT_FOUND')).toBe(true);
  });

  it('blocks when no scans exist', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'clinical_review', chief_complaint: 'crowding', organization_id: ORG }] },
      'FROM scans': { rows: [] },
      'FROM treatment_plans': { rows: [{ id: PLAN }] },
    });
    const result = await svc.evaluate(CASE, ORG);
    expect(result.canApprove).toBe(false);
    expect(result.blockers.some((b) => b.code === 'NO_SCANS')).toBe(true);
  });

  it('blocks when maxillary scan is missing', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'clinical_review', chief_complaint: 'crowding', organization_id: ORG }] },
      'FROM scans': { rows: [{ jaw_type: 'mandibular', status: 'approved', file_path: '/f.stl' }] },
      'FROM treatment_plans': { rows: [{ id: PLAN }] },
    });
    const result = await svc.evaluate(CASE, ORG);
    expect(result.canApprove).toBe(false);
    expect(result.blockers.some((b) => b.code === 'MISSING_MAXILLARY_SCAN')).toBe(true);
  });

  it('blocks when mandibular scan is missing', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'clinical_review', chief_complaint: 'crowding', organization_id: ORG }] },
      'FROM scans': { rows: [{ jaw_type: 'maxillary', status: 'approved', file_path: '/f.stl' }] },
      'FROM treatment_plans': { rows: [{ id: PLAN }] },
    });
    const result = await svc.evaluate(CASE, ORG);
    expect(result.canApprove).toBe(false);
    expect(result.blockers.some((b) => b.code === 'MISSING_MANDIBULAR_SCAN')).toBe(true);
  });

  it('blocks when simulated stages are present', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'clinical_review', chief_complaint: 'crowding', organization_id: ORG }] },
      'FROM scans': {
        rows: [
          { jaw_type: 'maxillary', status: 'approved', file_path: '/m.stl' },
          { jaw_type: 'mandibular', status: 'approved', file_path: '/l.stl' },
        ],
      },
      'FROM aligner_stages': { rows: [{ id: 's1' }] },
      'FROM treatment_plans WHERE id = $1 AND case_id': {
        rows: [{ id: PLAN, doctor_approval: false, approved_at: null, estimated_stages: 24, ai_recommendation_notes: null }],
      },
    });
    const result = await svc.evaluate(CASE, ORG, PLAN);
    expect(result.blockers.some((b) => b.code === 'SIMULATED_STAGES_PRESENT')).toBe(true);
  });

  it('returns canApprove=true with both scans, plan, no simulated stages', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'clinical_review', chief_complaint: 'crowding', organization_id: ORG }] },
      'FROM scans': {
        rows: [
          { jaw_type: 'maxillary', status: 'approved', file_path: '/m.stl' },
          { jaw_type: 'mandibular', status: 'approved', file_path: '/l.stl' },
        ],
      },
      'FROM aligner_stages': { rows: [] },
      'FROM treatment_plans WHERE id = $1 AND case_id': {
        rows: [{ id: PLAN, doctor_approval: false, approved_at: null, estimated_stages: 24, ai_recommendation_notes: null }],
      },
    });
    const result = await svc.evaluate(CASE, ORG, PLAN);
    expect(result.canApprove).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('exposes allowedNextActions when canApprove', async () => {
    await build({
      'FROM cases': { rows: [{ id: CASE, status: 'clinical_review', chief_complaint: 'crowding', organization_id: ORG }] },
      'FROM scans': {
        rows: [
          { jaw_type: 'maxillary', status: 'approved', file_path: '/m.stl' },
          { jaw_type: 'mandibular', status: 'approved', file_path: '/l.stl' },
        ],
      },
      'FROM aligner_stages': { rows: [] },
      'FROM treatment_plans WHERE id = $1 AND case_id': {
        rows: [{ id: PLAN, doctor_approval: false, approved_at: null, estimated_stages: 24, ai_recommendation_notes: null }],
      },
    });
    const result = await svc.evaluate(CASE, ORG, PLAN);
    expect(result.allowedNextActions).toContain('approve_plan');
  });
});
