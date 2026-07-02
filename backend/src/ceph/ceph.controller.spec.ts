import { CephController } from './ceph.controller';
import type { CephService } from './ceph.service';

function makeReq(overrides: Partial<{ user: { id: string; orgId: string | null } }> = {}) {
  return {
    user: { id: 'u1', email: 'dr@clinic.com', role: 'orthodontist', name: 'Dr Smith', orgId: 'org-1' },
    ...overrides,
  } as any;
}

function makeSvc(): CephService {
  return {
    list: jest.fn(async () => []),
    create: jest.fn(async () => ({ id: 'ceph-1' })),
    findOne: jest.fn(async () => ({ id: 'ceph-1' })),
    delete: jest.fn(async () => ({})),
  } as unknown as CephService;
}

describe('CephController.create', () => {
  it('uses req.user.id as createdBy fallback — not req.user.sub (which is undefined)', async () => {
    const svc = makeSvc();
    const ctrl = new CephController(svc);
    await ctrl.create('case-1', {} as any, makeReq());
    // create signature: (caseId, orgId, { ...dto, createdBy })
    const [, , merged] = (svc.create as jest.Mock).mock.calls[0];
    expect(merged.createdBy).toBe('u1');
    expect(merged.createdBy).not.toBeUndefined();
  });

  it('respects explicitly provided createdBy over the user id', async () => {
    const svc = makeSvc();
    const ctrl = new CephController(svc);
    await ctrl.create('case-1', { createdBy: 'external-id' } as any, makeReq());
    const [, , merged] = (svc.create as jest.Mock).mock.calls[0];
    expect(merged.createdBy).toBe('external-id');
  });

  it('passes orgId from req.user.orgId', async () => {
    const svc = makeSvc();
    const ctrl = new CephController(svc);
    await ctrl.create('case-1', {} as any, makeReq());
    const [, orgId] = (svc.create as jest.Mock).mock.calls[0];
    expect(orgId).toBe('org-1');
  });
});
