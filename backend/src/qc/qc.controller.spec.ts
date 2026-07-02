import { QcController } from './qc.controller';
import type { QcService } from './qc.service';

function makeReq(overrides: Partial<{ user: { id: string; orgId: string | null } }> = {}) {
  return {
    user: { id: 'u1', email: 'dr@clinic.com', role: 'orthodontist', name: 'Dr Smith', orgId: 'org-1' },
    ...overrides,
  } as any;
}

function makeSvc(): QcService {
  return {
    listJobs: jest.fn(async () => []),
    initChecks: jest.fn(async () => ({})),
    updateCheck: jest.fn(async () => ({})),
  } as unknown as QcService;
}

describe('QcController.updateCheck', () => {
  it('passes req.user.id as checkedBy — not req.user.sub (which is undefined)', async () => {
    const svc = makeSvc();
    const ctrl = new QcController(svc);
    await ctrl.updateCheck('job-1', 'check-1', { status: 'pass' }, makeReq());
    const [, , , body] = (svc.updateCheck as jest.Mock).mock.calls[0];
    expect(body.checkedBy).toBe('u1');
    expect(body.checkedBy).not.toBeUndefined();
  });

  it('passes orgId from req.user.orgId', async () => {
    const svc = makeSvc();
    const ctrl = new QcController(svc);
    await ctrl.updateCheck('job-1', 'check-1', { status: 'fail', notes: 'too thin' }, makeReq());
    const [, , orgId] = (svc.updateCheck as jest.Mock).mock.calls[0];
    expect(orgId).toBe('org-1');
  });
});
