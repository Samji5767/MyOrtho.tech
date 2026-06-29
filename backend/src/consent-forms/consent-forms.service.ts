import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ConsentTemplate {
  id: string;
  organizationId: string | null;
  title: string;
  contentMarkdown: string;
  version: string;
  requiresWitness: boolean;
  createdAt: string;
}

export interface PatientConsent {
  id: string;
  caseId: string;
  templateId: string;
  templateTitle: string;
  patientName: string;
  status: string;
  signedAt: string | null;
  witnessName: string | null;
  expiresAt: string;
  createdAt: string;
}

// Default templates seeded on first call
const DEFAULT_TEMPLATES = [
  {
    title: 'Orthodontic Treatment Consent',
    content: `# Orthodontic Treatment Informed Consent

## Treatment Description
I consent to the orthodontic treatment plan presented to me, including clear aligner therapy and associated clinical procedures.

## Risks and Limitations
I understand the following risks:
- Temporary discomfort during tooth movement
- Root resorption (shortening) in some cases
- Decalcification if oral hygiene is not maintained
- Treatment results may vary; relapse without retention
- Attachments may affect aesthetics temporarily

## Patient Responsibilities
I agree to:
- Wear aligners 20-22 hours per day unless otherwise specified
- Attend all scheduled appointments
- Maintain excellent oral hygiene
- Wear retainers as instructed after active treatment

## Clinician Approval Required
All treatment stages require clinician review and approval before fabrication.`,
    version: '2.1',
    requires_witness: false,
  },
  {
    title: 'CBCT Radiograph Consent',
    content: `# CBCT Cone Beam CT Scan Consent

## Purpose
A cone beam CT scan is recommended to better evaluate bone structure, root positions, and airway anatomy.

## Radiation Exposure
The radiation dose from CBCT is significantly less than conventional medical CT. The estimated effective dose is comparable to a full mouth series (FMX).

## Benefits and Risks
Benefits: 3D visualization of anatomy, improved surgical planning accuracy.
Risks: Low-level ionizing radiation exposure.

I consent to the CBCT scan as recommended by my treating orthodontist.`,
    version: '1.0',
    requires_witness: false,
  },
  {
    title: 'Photography & Records Consent',
    content: `# Clinical Photography and Records Consent

I consent to clinical photographs, digital scans, and radiographs being taken as part of my orthodontic records. These records:
- Are used for treatment planning and progress monitoring
- May be used for de-identified educational purposes with my approval
- Are stored securely in compliance with HIPAA regulations

I understand I may request copies of my records at any time.`,
    version: '1.0',
    requires_witness: false,
  },
];

@Injectable()
export class ConsentFormsService {
  private readonly log = new Logger(ConsentFormsService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  // ─── Templates ────────────────────────────────────────────────────────────

  async ensureDefaultTemplates(orgId: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*) as cnt FROM consent_templates WHERE organization_id=$1`,
      [orgId],
    );
    if (parseInt(rows[0]?.cnt ?? '0', 10) > 0) return;

    for (const t of DEFAULT_TEMPLATES) {
      await this.db.query(
        `INSERT INTO consent_templates (organization_id, title, content_markdown, version, requires_witness)
         VALUES ($1, $2, $3, $4, $5)`,
        [orgId, t.title, t.content, t.version, t.requires_witness],
      );
    }
  }

  async listTemplates(orgId: string): Promise<ConsentTemplate[]> {
    await this.ensureDefaultTemplates(orgId);
    const { rows } = await this.db.query(
      `SELECT id, organization_id, title, content_markdown, version, requires_witness, created_at
       FROM consent_templates WHERE organization_id=$1 AND is_active=true ORDER BY title`,
      [orgId],
    );
    return rows.map(this.mapTemplate);
  }

  async createTemplate(orgId: string, dto: { title: string; contentMarkdown: string; version?: string; requiresWitness?: boolean }): Promise<ConsentTemplate> {
    const { rows } = await this.db.query(
      `INSERT INTO consent_templates (organization_id, title, content_markdown, version, requires_witness)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [orgId, dto.title, dto.contentMarkdown, dto.version ?? '1.0', dto.requiresWitness ?? false],
    );
    return this.mapTemplate(rows[0]);
  }

  // ─── Consents ─────────────────────────────────────────────────────────────

  async listConsents(caseId: string, orgId: string): Promise<PatientConsent[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      `SELECT pc.*, ct.title as template_title
       FROM patient_consents pc
       JOIN consent_templates ct ON ct.id = pc.template_id
       WHERE pc.case_id=$1 AND pc.organization_id=$2
       ORDER BY pc.created_at DESC`,
      [caseId, orgId],
    );
    return rows.map(this.mapConsent);
  }

  async createConsent(caseId: string, orgId: string, dto: { templateId: string; patientName: string }): Promise<PatientConsent> {
    await this.verifyCase(caseId, orgId);
    const { rows: tmpl } = await this.db.query(
      `SELECT id FROM consent_templates WHERE id=$1 AND (organization_id=$2 OR organization_id IS NULL)`,
      [dto.templateId, orgId],
    );
    if (!tmpl[0]) throw new NotFoundException('Consent template not found');

    const { rows } = await this.db.query(
      `INSERT INTO patient_consents (organization_id, case_id, template_id, patient_name)
       VALUES ($1,$2,$3,$4)
       RETURNING *, (SELECT title FROM consent_templates WHERE id=$3) as template_title`,
      [orgId, caseId, dto.templateId, dto.patientName],
    );
    return this.mapConsent(rows[0]);
  }

  async signConsent(consentId: string, orgId: string, dto: { signatureData: string; witnessName?: string; ipAddress?: string }): Promise<PatientConsent> {
    if (!dto.signatureData?.trim()) throw new BadRequestException('Signature data is required');

    const { rows } = await this.db.query(
      `UPDATE patient_consents
       SET status='signed', signed_at=now(), signature_data=$2, witness_name=$3,
           witness_signed_at=CASE WHEN $3 IS NOT NULL THEN now() ELSE NULL END,
           ip_address=$4
       WHERE id=$1 AND organization_id=$5 AND status='pending'
       RETURNING *, (SELECT title FROM consent_templates WHERE id=template_id) as template_title`,
      [consentId, dto.signatureData, dto.witnessName ?? null, dto.ipAddress ?? null, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Consent not found or already processed');
    return this.mapConsent(rows[0]);
  }

  async declineConsent(consentId: string, orgId: string): Promise<PatientConsent> {
    const { rows } = await this.db.query(
      `UPDATE patient_consents SET status='declined'
       WHERE id=$1 AND organization_id=$2 AND status='pending'
       RETURNING *, (SELECT title FROM consent_templates WHERE id=template_id) as template_title`,
      [consentId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Consent not found or already processed');
    return this.mapConsent(rows[0]);
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT id FROM cases WHERE id=$1 AND organization_id=$2`, [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private mapTemplate(r: Record<string, unknown>): ConsentTemplate {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string | null,
      title: r['title'] as string,
      contentMarkdown: r['content_markdown'] as string,
      version: r['version'] as string,
      requiresWitness: r['requires_witness'] as boolean,
      createdAt: String(r['created_at']),
    };
  }

  private mapConsent(r: Record<string, unknown>): PatientConsent {
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      templateId: r['template_id'] as string,
      templateTitle: r['template_title'] as string,
      patientName: r['patient_name'] as string,
      status: r['status'] as string,
      signedAt: r['signed_at'] ? String(r['signed_at']) : null,
      witnessName: r['witness_name'] as string | null,
      expiresAt: String(r['expires_at']),
      createdAt: String(r['created_at']),
    };
  }
}
