import { UnauthorizedException } from '@nestjs/common';
import { CasesController } from './cases.controller';
import type { CasesService } from './cases.service';
import type { AiScoresService } from './ai-scores.service';
import type { DigitalTwinService } from './digital-twin.service';
import type { Request } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<{
  user: { id: string; email: string; role: string; name: string; orgId: string | null };
  headers: Record<string, string>;
  ip: string;
}> = {}): Request {
  return {
    user: { id: 'u1', email: 'dr@clinic.com', role: 'orthodontist', name: 'Dr Smith', orgId: 'org-1' },
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function makeSvc(overrides: Partial<Record<keyof CasesService, jest.Mock>> = {}): CasesService {
  return {
    findAllByOrg: jest.fn(async () => []),
    create: jest.fn(async () => ({ id: 'case-new' })),
    findOne: jest.fn(async () => ({ id: 'case-1' })),
    update: jest.fn(async () => ({ id: 'case-1' })),
    transition: jest.fn(async () => ({ id: 'case-1', status: 'approved' })),
    ...overrides,
  } as unknown as CasesService;
}

function makeAiSvc(): AiScoresService {
  return { getScores: jest.fn(async () => ({})) } as unknown as AiScoresService;
}

function makeDigitalTwinSvc(): DigitalTwinService {
  return { getDigitalTwin: jest.fn(async () => ({})) } as unknown as DigitalTwinService;
}

// ─── getCases ─────────────────────────────────────────────────────────────────

describe('CasesController.getCases', () => {
  it('delegates to casesService.findAllByOrg with user orgId', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.getCases(makeReq());
    expect(svc.findAllByOrg).toHaveBeenCalledWith('org-1', 100, 0, undefined);
  });

  it('returns [] when user has no orgId', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    const result = await ctrl.getCases(makeReq({ user: { id: 'u1', email: 'x@x.com', role: 'admin', name: 'X', orgId: null } }));
    expect(result).toEqual([]);
    expect(svc.findAllByOrg).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when no user on request', async () => {
    const ctrl = new CasesController(makeSvc(), makeAiSvc(), makeDigitalTwinSvc());
    await expect(ctrl.getCases({ headers: {}, ip: '127.0.0.1' } as unknown as Request))
      .rejects.toThrow(UnauthorizedException);
  });
});

// ─── createCase ───────────────────────────────────────────────────────────────

describe('CasesController.createCase', () => {
  const dto = { patientId: 'pat-1', chiefComplaint: 'crowding' };

  it('delegates to casesService.create with correct args', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.createCase(makeReq(), dto);
    expect(svc.create).toHaveBeenCalledWith(
      'org-1', 'u1', dto,
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });

  it('throws UnauthorizedException when user has no orgId', async () => {
    const ctrl = new CasesController(makeSvc(), makeAiSvc(), makeDigitalTwinSvc());
    await expect(
      ctrl.createCase(makeReq({ user: { id: 'u1', email: 'x', role: 'r', name: 'n', orgId: null } }), dto),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('passes x-forwarded-for IP to the audit context', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.createCase(
      makeReq({ headers: { 'x-forwarded-for': '10.0.0.5, 10.0.0.1' } }),
      dto,
    );
    const callArgs = (svc.create as jest.Mock).mock.calls[0];
    expect(callArgs[3].ipAddress).toBe('10.0.0.5');
  });
});

// ─── getCaseById ──────────────────────────────────────────────────────────────

describe('CasesController.getCaseById', () => {
  it('calls findOne with the case id and orgId', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.getCaseById(makeReq(), 'case-123');
    expect(svc.findOne).toHaveBeenCalledWith('case-123', 'org-1');
  });

  it('throws when user has no org', async () => {
    const ctrl = new CasesController(makeSvc(), makeAiSvc(), makeDigitalTwinSvc());
    await expect(
      ctrl.getCaseById(makeReq({ user: { id: 'u', email: 'e', role: 'r', name: 'n', orgId: null } }), 'c1'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── updateCase ───────────────────────────────────────────────────────────────

describe('CasesController.updateCase', () => {
  const dto = { chiefComplaint: 'spacing' };

  it('calls casesService.update with correct args', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.updateCase(makeReq(), 'case-1', dto);
    expect(svc.update).toHaveBeenCalledWith(
      'case-1', 'org-1', 'u1', dto,
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });
});

// ─── transitionCase ───────────────────────────────────────────────────────────

describe('CasesController.transitionCase', () => {
  it('calls casesService.transition with correct status', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.transitionCase(makeReq(), 'case-1', { toStatus: 'in_review' as any });
    expect(svc.transition).toHaveBeenCalledWith(
      'case-1', 'org-1', 'u1', 'orthodontist', 'in_review', undefined,
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });

  it('passes notes when provided', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.transitionCase(makeReq(), 'case-1', { toStatus: 'approved' as any, notes: 'LGTM' });
    const [,,,, , notes] = (svc.transition as jest.Mock).mock.calls[0];
    expect(notes).toBe('LGTM');
  });
});

// ─── approveCase ──────────────────────────────────────────────────────────────

describe('CasesController.approveCase', () => {
  it('calls casesService.transition with status "approved"', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.approveCase(makeReq(), 'case-1', { notes: 'approved by dr' });
    const [,,,, status] = (svc.transition as jest.Mock).mock.calls[0];
    expect(status).toBe('approved');
  });
});
