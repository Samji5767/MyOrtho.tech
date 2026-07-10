import { NotFoundException } from '@nestjs/common';
import { FhirService } from './fhir.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID    = 'org-aaaaaaaa';
const PAT_ID    = 'pat-11111111';
const CASE_ID   = 'case-22222222';
const EXPORT_ID = 'exp-33333333';
const ACTOR     = 'doc-1';

function makePatientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PAT_ID,
    organization_id: ORG_ID,
    first_name: 'Alice',
    last_name: 'Smith',
    date_of_birth: '1985-07-22',
    gender: 'female',
    ...overrides,
  };
}

function makeCaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CASE_ID,
    organization_id: ORG_ID,
    patient_id: PAT_ID,
    pat: PAT_ID,
    ...overrides,
  };
}

function makePool(rows: unknown[][]) {
  let i = 0;
  return {
    query: jest.fn(async () => ({ rows: rows[i++] ?? [], rowCount: 1 })),
  };
}

function makeService(pool: ReturnType<typeof makePool>) {
  return new FhirService(pool as any);
}

// ─── exportPatient ────────────────────────────────────────────────────────────

describe('FhirService.exportPatient', () => {
  it('builds a FHIR R4 Patient resource with correct resourceType', async () => {
    const pool = makePool([
      [makePatientRow()],
      [{ id: EXPORT_ID }],
    ]);
    const svc = makeService(pool);

    const { resource } = await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);

    expect(resource.resourceType).toBe('Patient');
  });

  it('includes the US Core patient profile in meta.profile', async () => {
    const pool = makePool([[makePatientRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);
    const { resource } = await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);
    const meta = resource.meta as { profile: string[] };
    expect(meta.profile).toContain('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient');
  });

  it('returns exportId from the DB INSERT', async () => {
    const pool = makePool([[makePatientRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);
    const { exportId } = await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);
    expect(exportId).toBe(EXPORT_ID);
  });

  it('identifier uses urn:myortho:patient system with patient id as value', async () => {
    const pool = makePool([[makePatientRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);
    const { resource } = await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);
    const identifier = resource.identifier as Array<{ system: string; value: string }>;
    expect(identifier[0].system).toBe('urn:myortho:patient');
    expect(identifier[0].value).toBe(PAT_ID);
  });

  it('name uses family and given from patient row', async () => {
    const pool = makePool([
      [makePatientRow({ first_name: 'María', last_name: 'García' })],
      [{ id: EXPORT_ID }],
    ]);
    const svc = makeService(pool);
    const { resource } = await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);
    const name = (resource.name as Array<{ family: string; given: string[] }>)[0];
    expect(name.family).toBe('García');
    expect(name.given[0]).toBe('María');
  });

  it('gender defaults to "unknown" when patient has no gender', async () => {
    const pool = makePool([
      [makePatientRow({ gender: null })],
      [{ id: EXPORT_ID }],
    ]);
    const svc = makeService(pool);
    const { resource } = await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);
    expect(resource.gender).toBe('unknown');
  });

  it('birthDate is sliced to YYYY-MM-DD (10 chars)', async () => {
    const pool = makePool([
      [makePatientRow({ date_of_birth: '1985-07-22T00:00:00.000Z' })],
      [{ id: EXPORT_ID }],
    ]);
    const svc = makeService(pool);
    const { resource } = await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);
    expect(resource.birthDate).toBe('1985-07-22');
  });

  it('birthDate is undefined when patient has no date_of_birth', async () => {
    const pool = makePool([
      [makePatientRow({ date_of_birth: null })],
      [{ id: EXPORT_ID }],
    ]);
    const svc = makeService(pool);
    const { resource } = await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);
    expect(resource.birthDate).toBeUndefined();
  });

  it('INSERT binds orgId, patientId, JSON payload, and exportedBy', async () => {
    const pool = makePool([[makePatientRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);

    await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);

    const [, params] = (pool.query as jest.Mock).mock.calls[1];
    expect(params[0]).toBe(ORG_ID);
    expect(params[1]).toBe(PAT_ID);
    expect(typeof params[2]).toBe('string'); // JSON payload
    expect(JSON.parse(params[2] as string).resourceType).toBe('Patient');
    expect(params[3]).toBe(ACTOR);
  });

  it('SELECT queries with id=$1 AND organization_id=$2 for org isolation', async () => {
    const pool = makePool([[makePatientRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);

    await svc.exportPatient(ORG_ID, PAT_ID, ACTOR);

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND organization_id=\$2/);
    expect(params[0]).toBe(PAT_ID);
    expect(params[1]).toBe(ORG_ID);
  });

  it('throws NotFoundException when patient is not in the org', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);
    await expect(svc.exportPatient(ORG_ID, PAT_ID, ACTOR)).rejects.toThrow(NotFoundException);
  });
});

// ─── exportCbctObservation ────────────────────────────────────────────────────

describe('FhirService.exportCbctObservation', () => {
  it('builds a FHIR R4 Observation resource', async () => {
    const pool = makePool([[makeCaseRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);
    const { resource } = await svc.exportCbctObservation(ORG_ID, CASE_ID, ACTOR);
    expect(resource.resourceType).toBe('Observation');
  });

  it('uses LOINC code 36643-5 (CT maxillofacial)', async () => {
    const pool = makePool([[makeCaseRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);
    const { resource } = await svc.exportCbctObservation(ORG_ID, CASE_ID, ACTOR);
    const code = resource.code as { coding: Array<{ system: string; code: string; display: string }> };
    expect(code.coding[0].system).toBe('http://loinc.org');
    expect(code.coding[0].code).toBe('36643-5');
    expect(code.coding[0].display).toBe('CT maxillofacial');
  });

  it('status is "final"', async () => {
    const pool = makePool([[makeCaseRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);
    const { resource } = await svc.exportCbctObservation(ORG_ID, CASE_ID, ACTOR);
    expect(resource.status).toBe('final');
  });

  it('subject.reference points to the patient', async () => {
    const pool = makePool([[makeCaseRow({ patient_id: PAT_ID })], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);
    const { resource } = await svc.exportCbctObservation(ORG_ID, CASE_ID, ACTOR);
    const subject = resource.subject as { reference: string };
    expect(subject.reference).toBe(`Patient/${PAT_ID}`);
  });

  it('note text includes the caseId', async () => {
    const pool = makePool([[makeCaseRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);
    const { resource } = await svc.exportCbctObservation(ORG_ID, CASE_ID, ACTOR);
    const note = (resource.note as Array<{ text: string }>)[0];
    expect(note.text).toContain(CASE_ID);
  });

  it('throws NotFoundException when case is not in the org', async () => {
    const pool = makePool([[]]); // case not found
    const svc = makeService(pool);
    await expect(svc.exportCbctObservation(ORG_ID, CASE_ID, ACTOR)).rejects.toThrow(NotFoundException);
  });

  it('returns exportId from INSERT', async () => {
    const pool = makePool([[makeCaseRow()], [{ id: EXPORT_ID }]]);
    const svc = makeService(pool);
    const { exportId } = await svc.exportCbctObservation(ORG_ID, CASE_ID, ACTOR);
    expect(exportId).toBe(EXPORT_ID);
  });
});

// ─── listExports ──────────────────────────────────────────────────────────────

describe('FhirService.listExports', () => {
  it('returns formatted export rows', async () => {
    const pool = makePool([[
      { id: 'exp-1', resource_type: 'Patient', payload: { resourceType: 'Patient' }, created_at: '2026-01-01' },
      { id: 'exp-2', resource_type: 'Observation', payload: { resourceType: 'Observation' }, created_at: '2026-01-02' },
    ]]);
    const svc = makeService(pool);

    const rows = await svc.listExports(ORG_ID);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('exp-1');
    expect(rows[0].resourceType).toBe('Patient');
    expect(rows[1].resourceType).toBe('Observation');
  });

  it('queries without resource_type filter when not provided', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await svc.listExports(ORG_ID);

    const [, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(params).toEqual([ORG_ID]);
  });

  it('queries with resource_type filter when provided', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);

    await svc.listExports(ORG_ID, 'Patient');

    const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/AND resource_type=\$2/);
    expect(params[0]).toBe(ORG_ID);
    expect(params[1]).toBe('Patient');
  });

  it('returns empty array when no exports exist', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);
    const rows = await svc.listExports(ORG_ID);
    expect(rows).toEqual([]);
  });

  it('orders results by created_at DESC', async () => {
    const pool = makePool([[]]);
    const svc = makeService(pool);
    await svc.listExports(ORG_ID);
    const [sql] = (pool.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/ORDER BY created_at DESC/);
  });
});
