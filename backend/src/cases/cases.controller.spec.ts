import { UnauthorizedException } from '@nestjs/common';
import { CasesController } from './cases.controller';
import type { CasesService } from './cases.service';
import type { AiScoresService } from './ai-scores.service';
import type { DigitalTwinService } from './digital-twin.service';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.guard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_USER: AuthUser = {
  id: 'u1',
  email: 'dr@clinic.com',
  role: 'orthodontist',
  name: 'Dr Smith',
  orgId: 'org-1',
  workspaceId: 'ws-1',
  jti: 'test-jti',
};

const SCOPE_WS = { kind: 'workspace', orgId: 'org-1', workspaceId: 'ws-1' } as const;

function makeReq(userOverride?: Partial<AuthUser>): Request {
  return {
    user: { ...DEFAULT_USER, ...userOverride },
    headers: {},
    ip: '127.0.0.1',
  } as unknown as Request;
}

function makeReqWithHeaders(headers: Record<string, string>): Request {
  return {
    user: DEFAULT_USER,
    headers,
    ip: '127.0.0.1',
  } as unknown as Request;
}

function makeSvc(overrides: Partial<Record<keyof CasesService, jest.Mock>> = {}): CasesService {
  return {
    findAll: jest.fn(async () => []),
    createByScope: jest.fn(async () => ({ id: 'case-new' })),
    createWithNewPatientByScope: jest.fn(async () => ({ id: 'case-new' })),
    findOneByScope: jest.fn(async () => ({ id: 'case-1' })),
    updateByScope: jest.fn(async () => ({ id: 'case-1' })),
    transitionByScope: jest.fn(async () => ({ id: 'case-1', status: 'approved' })),
    getAnalyticsSummaryByScope: jest.fn(async () => ({ total: 0 })),
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
  it('delegates to casesService.findAll with workspace scope', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.getCases(makeReq());
    expect(svc.findAll).toHaveBeenCalledWith(SCOPE_WS, 100, 0, undefined);
  });

  it('throws UnauthorizedException when user has no workspaceId and is not an admin', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await expect(
      ctrl.getCases(makeReq({ workspaceId: null })),
    ).rejects.toThrow(UnauthorizedException);
    expect(svc.findAll).not.toHaveBeenCalled();
  });

  it('admin with orgId and no workspace gets org-wide scope', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.getCases(makeReq({ role: 'admin', workspaceId: null }));
    expect(svc.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'org', orgId: 'org-1' }),
      100, 0, undefined,
    );
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

  it('delegates to casesService.createByScope with correct args', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.createCase(makeReq(), dto);
    expect(svc.createByScope).toHaveBeenCalledWith(
      SCOPE_WS, 'u1', dto,
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });

  it('throws UnauthorizedException when user has no scope (no workspace, non-admin)', async () => {
    const ctrl = new CasesController(makeSvc(), makeAiSvc(), makeDigitalTwinSvc());
    await expect(
      ctrl.createCase(makeReq({ workspaceId: null }), dto),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('passes x-forwarded-for IP to the audit context', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.createCase(
      makeReqWithHeaders({ 'x-forwarded-for': '10.0.0.5, 10.0.0.1' }),
      dto,
    );
    const callArgs = (svc.createByScope as jest.Mock).mock.calls[0];
    expect(callArgs[3].ipAddress).toBe('10.0.0.5');
  });
});

// ─── createCaseWithNewPatient ─────────────────────────────────────────────────

describe('CasesController.createCaseWithNewPatient', () => {
  const dto = { patient: { firstName: 'Jane', lastName: 'Doe' }, chiefComplaint: 'crowding' };

  it('delegates to casesService.createWithNewPatientByScope', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.createCaseWithNewPatient(makeReq(), dto as any);
    expect(svc.createWithNewPatientByScope).toHaveBeenCalledWith(
      SCOPE_WS, 'u1', dto,
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });
});

// ─── getAnalyticsSummary ──────────────────────────────────────────────────────

describe('CasesController.getAnalyticsSummary', () => {
  it('delegates to casesService.getAnalyticsSummaryByScope with scope', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.getAnalyticsSummary(makeReq());
    expect(svc.getAnalyticsSummaryByScope).toHaveBeenCalledWith(SCOPE_WS);
  });
});

// ─── getCaseById ──────────────────────────────────────────────────────────────

describe('CasesController.getCaseById', () => {
  it('calls findOneByScope with the case id and scope', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.getCaseById(makeReq(), 'case-123');
    expect(svc.findOneByScope).toHaveBeenCalledWith('case-123', SCOPE_WS);
  });

  it('throws when user has no effective scope', async () => {
    const ctrl = new CasesController(makeSvc(), makeAiSvc(), makeDigitalTwinSvc());
    await expect(
      ctrl.getCaseById(makeReq({ workspaceId: null }), 'c1'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── updateCase ───────────────────────────────────────────────────────────────

describe('CasesController.updateCase', () => {
  const dto = { chiefComplaint: 'spacing' };

  it('calls casesService.updateByScope with correct args', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.updateCase(makeReq(), 'case-1', dto);
    expect(svc.updateByScope).toHaveBeenCalledWith(
      'case-1', SCOPE_WS, 'u1', dto,
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });
});

// ─── transitionCase ───────────────────────────────────────────────────────────

describe('CasesController.transitionCase', () => {
  it('calls casesService.transitionByScope with correct status', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.transitionCase(makeReq(), 'case-1', { toStatus: 'scan_review' as any });
    expect(svc.transitionByScope).toHaveBeenCalledWith(
      'case-1', SCOPE_WS, 'u1', 'orthodontist', 'scan_review', undefined,
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });

  it('passes notes when provided', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.transitionCase(makeReq(), 'case-1', { toStatus: 'approved' as any, notes: 'LGTM' });
    const [, , , , , notes] = (svc.transitionByScope as jest.Mock).mock.calls[0];
    expect(notes).toBe('LGTM');
  });
});

// ─── approveCase ──────────────────────────────────────────────────────────────

describe('CasesController.approveCase', () => {
  it('calls casesService.transitionByScope with status "approved"', async () => {
    const svc = makeSvc();
    const ctrl = new CasesController(svc, makeAiSvc(), makeDigitalTwinSvc());

    await ctrl.approveCase(makeReq(), 'case-1', { notes: 'approved by dr' });
    const [, , , , status] = (svc.transitionByScope as jest.Mock).mock.calls[0];
    expect(status).toBe('approved');
  });
});

// ─── getAiScores ──────────────────────────────────────────────────────────────

describe('CasesController.getAiScores', () => {
  it('calls aiScoresService.getScores with case id and orgId', async () => {
    const aiSvc = makeAiSvc();
    const ctrl = new CasesController(makeSvc(), aiSvc, makeDigitalTwinSvc());

    await ctrl.getAiScores(makeReq(), 'case-1');
    expect(aiSvc.getScores).toHaveBeenCalledWith('case-1', 'org-1');
  });

  it('throws when user has no orgId', async () => {
    const ctrl = new CasesController(makeSvc(), makeAiSvc(), makeDigitalTwinSvc());
    await expect(
      ctrl.getAiScores(makeReq({ orgId: null }), 'case-1'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── getDigitalTwin ───────────────────────────────────────────────────────────

describe('CasesController.getDigitalTwin', () => {
  it('calls digitalTwinService.getDigitalTwin with case id and orgId', async () => {
    const dtSvc = makeDigitalTwinSvc();
    const ctrl = new CasesController(makeSvc(), makeAiSvc(), dtSvc);

    await ctrl.getDigitalTwin(makeReq(), 'case-1');
    expect(dtSvc.getDigitalTwin).toHaveBeenCalledWith('case-1', 'org-1');
  });
});
