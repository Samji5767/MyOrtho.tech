import { PhotosController } from './photos.controller';
import type { PhotosService } from './photos.service';
import type { AuditService } from '../audit/audit.service';

function makeReq(overrides: Partial<{ user: { id: string; orgId: string | null } }> = {}) {
  return {
    user: { id: 'u1', email: 'dr@clinic.com', role: 'orthodontist', name: 'Dr Smith', orgId: 'org-1' },
    ...overrides,
  } as any;
}

function makeSvc(): PhotosService {
  return {
    list: jest.fn(async () => []),
    create: jest.fn(async () => ({ id: 'photo-1' })),
    delete: jest.fn(async () => ({})),
  } as unknown as PhotosService;
}

function makeAudit(): AuditService {
  return { log: jest.fn(async () => undefined) } as unknown as AuditService;
}

// uploadedBy omitted at runtime (undefined) to exercise the req.user.id fallback path
const baseDto = {
  photoType: 'frontal_rest' as const,
  filePath: '/uploads/photo.jpg',
  fileSizeBytes: 512000,
  originalFilename: 'photo.jpg',
  uploadedBy: undefined as any,
};

describe('PhotosController.create', () => {
  it('uses req.user.id as uploadedBy fallback — not req.user.sub (which is undefined)', async () => {
    const svc = makeSvc();
    const ctrl = new PhotosController(svc, makeAudit());
    await ctrl.create('case-1', baseDto, makeReq());
    // create signature: (caseId, orgId, { ...dto, uploadedBy })
    const [, , merged] = (svc.create as jest.Mock).mock.calls[0];
    expect(merged.uploadedBy).toBe('u1');
    expect(merged.uploadedBy).not.toBeUndefined();
  });

  it('respects explicitly provided uploadedBy over the user id', async () => {
    const svc = makeSvc();
    const ctrl = new PhotosController(svc, makeAudit());
    await ctrl.create('case-1', { ...baseDto, uploadedBy: 'tech-user' } as any, makeReq());
    const [, , merged] = (svc.create as jest.Mock).mock.calls[0];
    expect(merged.uploadedBy).toBe('tech-user');
  });

  it('passes orgId from req.user.orgId', async () => {
    const svc = makeSvc();
    const ctrl = new PhotosController(svc, makeAudit());
    await ctrl.create('case-1', baseDto, makeReq());
    const [, orgId] = (svc.create as jest.Mock).mock.calls[0];
    expect(orgId).toBe('org-1');
  });
});
