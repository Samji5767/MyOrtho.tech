import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

type FhirResourceType = 'Patient' | 'Observation' | 'Condition' | 'Procedure' | 'DiagnosticReport';

export interface FhirExportRow { id: string; resourceType: FhirResourceType; payload: Record<string, unknown>; createdAt: string }

@Injectable()
export class FhirService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async exportPatient(orgId: string, patientId: string, exportedBy: string): Promise<{ exportId: string; resource: Record<string, unknown> }> {
    const { rows: p } = await this.db.query(
      'SELECT * FROM patients WHERE id=$1 AND organization_id=$2', [patientId, orgId],
    );
    if (!p[0]) throw new NotFoundException('Patient not found');
    const pt = p[0];

    const resource: Record<string, unknown> = {
      resourceType: 'Patient',
      id: pt['id'],
      meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'] },
      identifier: [{ system: 'urn:myortho:patient', value: pt['id'] }],
      name: [{ use: 'official', family: pt['last_name'], given: [pt['first_name']] }],
      birthDate: pt['date_of_birth'] ? String(pt['date_of_birth']).slice(0, 10) : undefined,
      gender: pt['gender'] ?? 'unknown',
    };

    const { rows } = await this.db.query(
      `INSERT INTO fhir_exports (organization_id, resource_type, patient_id, fhir_version, payload, exported_by)
       VALUES ($1,'Patient',$2,'R4',$3,$4) RETURNING id`,
      [orgId, patientId, JSON.stringify(resource), exportedBy],
    );
    return { exportId: rows[0]['id'] as string, resource };
  }

  async exportCbctObservation(orgId: string, caseId: string, exportedBy: string): Promise<{ exportId: string; resource: Record<string, unknown> }> {
    const { rows: c } = await this.db.query(
      'SELECT c.*, p.id AS pat FROM cases c JOIN patients p ON p.id=c.patient_id WHERE c.id=$1 AND c.organization_id=$2',
      [caseId, orgId],
    );
    if (!c[0]) throw new NotFoundException('Case not found');

    const resource: Record<string, unknown> = {
      resourceType: 'Observation',
      id: caseId,
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '36643-5', display: 'CT maxillofacial' }] },
      subject: { reference: `Patient/${c[0]['patient_id']}` },
      effectiveDateTime: new Date().toISOString(),
      note: [{ text: `MyOrtho.tech CBCT fusion case ${caseId}` }],
    };

    const { rows } = await this.db.query(
      `INSERT INTO fhir_exports (organization_id, resource_type, case_id, fhir_version, payload, exported_by)
       VALUES ($1,'Observation',$2,'R4',$3,$4) RETURNING id`,
      [orgId, caseId, JSON.stringify(resource), exportedBy],
    );
    return { exportId: rows[0]['id'] as string, resource };
  }

  async listExports(orgId: string, resourceType?: string): Promise<FhirExportRow[]> {
    const { rows } = await this.db.query(
      `SELECT id, resource_type, payload, created_at FROM fhir_exports
       WHERE organization_id=$1 ${resourceType ? 'AND resource_type=$2' : ''} ORDER BY created_at DESC LIMIT 100`,
      resourceType ? [orgId, resourceType] : [orgId],
    );
    return rows.map(r => ({
      id: r['id'] as string,
      resourceType: r['resource_type'] as FhirResourceType,
      payload: r['payload'] as Record<string, unknown>,
      createdAt: String(r['created_at']),
    }));
  }
}
