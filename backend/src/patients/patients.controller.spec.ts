import { UnauthorizedException } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import type { PatientsService } from './patients.service';
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

function makeSvc(overrides: Partial<Record<keyof PatientsService, jest.Mock>> = {}): PatientsService {
  return {
    findAllByScope: jest.fn(async () => []),
    create: jest.fn(async () => ({ id: 'pat-new' })),
    findOneByScope: jest.fn(async () => ({ id: 'pat-1' })),
    updateByScope: jest.fn(async () => ({ id: 'pat-1' })),
    archive: jest.fn(async () => ({ id: 'pat-1', archived: true })),
    restore: jest.fn(async () => ({ id: 'pat-1', archived: false })),
    getTimelineByScope: jest.fn(async () => []),
    addTimelineNoteByScope: jest.fn(async () => ({ id: 'note-1' })),
    ...overrides,
  } as unknown as PatientsService;
}

// ─── getPatients ──────────────────────────────────────────────────────────────

describe('PatientsController.getPatients', () => {
  it('delegates to patientsService.findAllByScope with workspace scope', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.getPatients(makeReq());
    expect(svc.findAllByScope).toHaveBeenCalledWith(SCOPE_WS, 100, 0, false);
  });

  it('parses limit and offset from query params', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.getPatients(makeReq(), '20', '40');
    expect(svc.findAllByScope).toHaveBeenCalledWith(SCOPE_WS, 20, 40, false);
  });

  it('passes includeArchived=true when query param is "true"', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.getPatients(makeReq(), undefined, undefined, 'true');
    expect(svc.findAllByScope).toHaveBeenCalledWith(SCOPE_WS, 100, 0, true);
  });

  it('throws UnauthorizedException when user has no effective scope', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await expect(
      ctrl.getPatients(makeReq({ workspaceId: null })),
    ).rejects.toThrow(UnauthorizedException);
    expect(svc.findAllByScope).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when no user on request', async () => {
    const ctrl = new PatientsController(makeSvc());
    await expect(ctrl.getPatients({ headers: {}, ip: '127.0.0.1' } as unknown as Request))
      .rejects.toThrow(UnauthorizedException);
  });
});

// ─── createPatient ────────────────────────────────────────────────────────────

describe('PatientsController.createPatient', () => {
  const dto = { firstName: 'Jane', lastName: 'Doe' };

  it('delegates to patientsService.create with orgId and workspaceId', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.createPatient(makeReq(), dto as any);
    expect(svc.create).toHaveBeenCalledWith(
      'org-1', 'u1', dto,
      expect.objectContaining({ actorEmail: 'dr@clinic.com', workspaceId: 'ws-1' }),
    );
  });

  it('throws UnauthorizedException when user has no orgId', async () => {
    const ctrl = new PatientsController(makeSvc());
    await expect(
      ctrl.createPatient(makeReq({ orgId: null }), dto as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('passes x-forwarded-for IP to the audit context', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.createPatient(
      makeReqWithHeaders({ 'x-forwarded-for': '10.0.0.5, 10.0.0.1' }),
      dto as any,
    );
    const callArgs = (svc.create as jest.Mock).mock.calls[0];
    expect(callArgs[3].ipAddress).toBe('10.0.0.5');
  });
});

// ─── getPatientById ───────────────────────────────────────────────────────────

describe('PatientsController.getPatientById', () => {
  it('calls findOneByScope with the patient id and scope', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.getPatientById(makeReq(), 'pat-123');
    expect(svc.findOneByScope).toHaveBeenCalledWith('pat-123', SCOPE_WS);
  });

  it('throws when user has no effective scope', async () => {
    const ctrl = new PatientsController(makeSvc());
    await expect(
      ctrl.getPatientById(makeReq({ workspaceId: null }), 'pat-1'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── updatePatient ────────────────────────────────────────────────────────────

describe('PatientsController.updatePatient', () => {
  const dto = { firstName: 'Updated' };

  it('calls patientsService.updateByScope with correct args', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.updatePatient(makeReq(), 'pat-1', dto as any);
    expect(svc.updateByScope).toHaveBeenCalledWith(
      'pat-1', SCOPE_WS, 'u1', dto,
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });
});

// ─── archivePatient ───────────────────────────────────────────────────────────

describe('PatientsController.archivePatient', () => {
  it('calls patientsService.archive with workspaceId from scope', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.archivePatient(makeReq(), 'pat-1');
    expect(svc.archive).toHaveBeenCalledWith(
      'pat-1', 'ws-1', 'u1',
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });

  it('throws UnauthorizedException when scope is not workspace', async () => {
    const ctrl = new PatientsController(makeSvc());
    await expect(
      ctrl.archivePatient(makeReq({ role: 'admin', workspaceId: null }), 'pat-1'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── restorePatient ───────────────────────────────────────────────────────────

describe('PatientsController.restorePatient', () => {
  it('calls patientsService.restore with workspaceId from scope', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.restorePatient(makeReq(), 'pat-1');
    expect(svc.restore).toHaveBeenCalledWith(
      'pat-1', 'ws-1', 'u1',
      expect.objectContaining({ actorEmail: 'dr@clinic.com' }),
    );
  });

  it('throws UnauthorizedException when scope is not workspace', async () => {
    const ctrl = new PatientsController(makeSvc());
    await expect(
      ctrl.restorePatient(makeReq({ role: 'admin', workspaceId: null }), 'pat-1'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── getTimeline ──────────────────────────────────────────────────────────────

describe('PatientsController.getTimeline', () => {
  it('calls patientsService.getTimelineByScope with correct args', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.getTimeline(makeReq(), 'pat-1');
    expect(svc.getTimelineByScope).toHaveBeenCalledWith('pat-1', SCOPE_WS);
  });
});

// ─── addTimelineNote ──────────────────────────────────────────────────────────

describe('PatientsController.addTimelineNote', () => {
  const dto = { note: 'Patient looks great' };

  it('calls patientsService.addTimelineNoteByScope with correct args', async () => {
    const svc = makeSvc();
    const ctrl = new PatientsController(svc);

    await ctrl.addTimelineNote(makeReq(), 'pat-1', dto as any);
    expect(svc.addTimelineNoteByScope).toHaveBeenCalledWith('pat-1', SCOPE_WS, 'u1', dto);
  });
});
