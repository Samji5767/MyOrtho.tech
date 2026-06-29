import { Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import * as crypto from 'crypto';

const PORTAL_TOKEN_TTL_HOURS = 72;

@Injectable()
export class PatientPortalService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async issuePortalToken(orgId: string, patientId: string): Promise<{ token: string; expiresAt: Date }> {
    const { rows: p } = await this.db.query(
      'SELECT id FROM patients WHERE id=$1 AND organization_id=$2', [patientId, orgId],
    );
    if (!p[0]) throw new NotFoundException('Patient not found');

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + PORTAL_TOKEN_TTL_HOURS * 3600_000);

    await this.db.query(
      `INSERT INTO patient_portal_tokens (organization_id, patient_id, token_hash, expires_at)
       VALUES ($1,$2,$3,$4)`,
      [orgId, patientId, tokenHash, expiresAt],
    );
    return { token, expiresAt };
  }

  async resolvePortalToken(token: string): Promise<{ patientId: string; orgId: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await this.db.query(
      `SELECT patient_id, organization_id FROM patient_portal_tokens
       WHERE token_hash=$1 AND expires_at > now()`,
      [tokenHash],
    );
    if (!rows[0]) throw new UnauthorizedException('Invalid or expired portal token');
    return { patientId: rows[0]['patient_id'] as string, orgId: rows[0]['organization_id'] as string };
  }

  async getPatientProgress(patientId: string, orgId: string) {
    const { rows: cases } = await this.db.query(
      `SELECT c.id, c.status, c.created_at,
              (SELECT count(*) FROM scans s WHERE s.case_id=c.id) AS scan_count
       FROM cases c
       WHERE c.patient_id=$1 AND c.organization_id=$2
       ORDER BY c.created_at DESC LIMIT 10`,
      [patientId, orgId],
    );
    return cases.map(r => ({
      caseId: r['id'],
      status: r['status'],
      createdAt: r['created_at'],
      scanCount: Number(r['scan_count']),
    }));
  }

  async getPatientAppointments(patientId: string, orgId: string) {
    const { rows } = await this.db.query(
      `SELECT a.id, a.scheduled_at, a.duration_minutes, a.status, at2.name AS type_name
       FROM appointments a
       JOIN appointment_types at2 ON at2.id = a.appointment_type_id
       JOIN cases c ON c.id = a.case_id
       WHERE c.patient_id=$1 AND a.organization_id=$2 AND a.scheduled_at >= now()
       ORDER BY a.scheduled_at ASC LIMIT 20`,
      [patientId, orgId],
    );
    return rows.map(r => ({
      id: r['id'],
      typeName: r['type_name'],
      scheduledAt: r['scheduled_at'],
      durationMinutes: r['duration_minutes'],
      status: r['status'],
    }));
  }

  async getPendingConsents(patientId: string, orgId: string) {
    const { rows } = await this.db.query(
      `SELECT pc.id, ct.title, pc.expires_at, pc.created_at
       FROM patient_consents pc
       JOIN consent_templates ct ON ct.id = pc.template_id
       JOIN cases c ON c.id = pc.case_id
       WHERE c.patient_id=$1 AND pc.organization_id=$2 AND pc.status='pending'
       ORDER BY pc.created_at DESC`,
      [patientId, orgId],
    );
    return rows.map(r => ({
      id: r['id'],
      templateTitle: r['title'],
      expiresAt: r['expires_at'],
      createdAt: r['created_at'],
    }));
  }

  async signConsentPortal(consentId: string, patientId: string, orgId: string, signatureData: string) {
    const { rows } = await this.db.query(
      `UPDATE patient_consents SET status='signed', signed_at=now(), signature_data=$3, updated_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='pending'
       AND case_id IN (SELECT id FROM cases WHERE patient_id=$4)
       RETURNING id`,
      [consentId, orgId, signatureData, patientId],
    );
    if (!rows[0]) throw new NotFoundException('Consent not found or already processed');
    return { id: rows[0]['id'], status: 'signed' };
  }
}
