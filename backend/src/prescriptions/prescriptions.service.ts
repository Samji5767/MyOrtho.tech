import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface Prescription {
  id: string; caseId: string; patientId: string; prescribedBy: string;
  medicationName: string; strength: string | null; dosageForm: string | null;
  sig: string; quantity: string; refills: number; indication: string | null;
  status: string; filledAt: string | null; expiresAt: string | null; createdAt: string;
}

@Injectable()
export class PrescriptionsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listRx(caseId: string, orgId: string): Promise<Prescription[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      'SELECT * FROM prescriptions WHERE case_id=$1 AND organization_id=$2 ORDER BY created_at DESC',
      [caseId, orgId],
    );
    return rows.map(this.map);
  }

  async createRx(caseId: string, orgId: string, prescribedBy: string, dto: {
    medicationName: string; strength?: string; dosageForm?: string;
    sig: string; quantity: string; refills?: number; indication?: string; expiresAt?: string;
  }): Promise<Prescription> {
    const { rows: c } = await this.db.query(
      'SELECT patient_id FROM cases WHERE id=$1 AND organization_id=$2', [caseId, orgId],
    );
    if (!c[0]) throw new NotFoundException('Case not found');
    const patientId = c[0]['patient_id'] as string;

    const { rows } = await this.db.query(
      `INSERT INTO prescriptions
         (organization_id, case_id, patient_id, prescribed_by, medication_name, strength, dosage_form,
          sig, quantity, refills, indication, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [orgId, caseId, patientId, prescribedBy, dto.medicationName, dto.strength ?? null,
       dto.dosageForm ?? null, dto.sig, dto.quantity, dto.refills ?? 0,
       dto.indication ?? null, dto.expiresAt ?? null],
    );
    return this.map(rows[0]);
  }

  async fillRx(rxId: string, orgId: string): Promise<Prescription> {
    const { rows } = await this.db.query(
      `UPDATE prescriptions SET status='filled', filled_at=now(), updated_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='active' RETURNING *`,
      [rxId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Prescription not found or not active');
    return this.map(rows[0]);
  }

  async cancelRx(rxId: string, orgId: string): Promise<Prescription> {
    const { rows } = await this.db.query(
      `UPDATE prescriptions SET status='cancelled', updated_at=now()
       WHERE id=$1 AND organization_id=$2 AND status IN ('active') RETURNING *`,
      [rxId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Prescription not found or not cancellable');
    return this.map(rows[0]);
  }

  async listOrgRx(orgId: string, status?: string): Promise<Prescription[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM prescriptions WHERE organization_id=$1 ${status ? 'AND status=$2' : ''} ORDER BY created_at DESC LIMIT 100`,
      status ? [orgId, status] : [orgId],
    );
    return rows.map(this.map);
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query('SELECT id FROM cases WHERE id=$1 AND organization_id=$2', [caseId, orgId]);
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private map(r: Record<string, unknown>): Prescription {
    return {
      id: r['id'] as string, caseId: r['case_id'] as string, patientId: r['patient_id'] as string,
      prescribedBy: r['prescribed_by'] as string, medicationName: r['medication_name'] as string,
      strength: r['strength'] as string | null, dosageForm: r['dosage_form'] as string | null,
      sig: r['sig'] as string, quantity: r['quantity'] as string, refills: r['refills'] as number,
      indication: r['indication'] as string | null, status: r['status'] as string,
      filledAt: r['filled_at'] ? String(r['filled_at']) : null,
      expiresAt: r['expires_at'] ? String(r['expires_at']) : null,
      createdAt: String(r['created_at']),
    };
  }
}
