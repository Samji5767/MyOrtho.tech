import { StagesController } from './stages.controller';
import type { StagesService } from './stages.service';

function makeReq(overrides: Partial<{ user: { id: string; orgId: string | null } }> = {}) {
  return {
    user: { id: 'u1', email: 'dr@clinic.com', role: 'orthodontist', name: 'Dr Smith', orgId: 'org-1' },
    ...overrides,
  } as any;
}

function makeSvc(): StagesService {
  return {
    list: jest.fn(async () => []),
    create: jest.fn(async () => ({})),
    generate: jest.fn(async () => ({})),
    approve: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
  } as unknown as StagesService;
}

describe('StagesController.approve', () => {
  it('passes req.user.id as approver — not req.user.sub (which is undefined)', async () => {
    const svc = makeSvc();
    const ctrl = new StagesController(svc);
    await ctrl.approve('plan-1', 'case-1', 'stage-1', makeReq());
    // approve signature: (planId, caseId, orgId, stageId, approver)
    const [, , , , approver] = (svc.approve as jest.Mock).mock.calls[0];
    expect(approver).toBe('u1');
    expect(approver).not.toBeUndefined();
  });

  it('passes orgId from req.user.orgId', async () => {
    const svc = makeSvc();
    const ctrl = new StagesController(svc);
    await ctrl.approve('plan-1', 'case-1', 'stage-1', makeReq());
    const [, , orgId] = (svc.approve as jest.Mock).mock.calls[0];
    expect(orgId).toBe('org-1');
  });
});
