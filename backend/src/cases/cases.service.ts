import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../common/crypto.service';
import { WorkflowService, type CaseStatus } from '../workflow/workflow.service';

export interface CreateCaseDto {
  patientId: string;
  chiefComplaint?: string;
  malocclusionClass?: string;
  notes?: string;
}

export interface CreateCaseWithPatientDto {
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    clinicalNotes?: string;
  };
  chiefComplaint?: string;
  malocclusionClass?: string;
  notes?: string;
}

export interface UpdateCaseDto {
  chiefComplaint?: string;
  malocclusionClass?: string;
  notes?: string;
}

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
    private readonly workflowService: WorkflowService,
    private readonly cryptoService: CryptoService,
  ) {}

  private assertValidDob(dob: string | undefined): void {
    if (!dob) return;
    const match = /^(\d{4})-\d{2}-\d{2}$/.exec(dob);
    if (!match) throw new BadRequestException('dateOfBirth must be in YYYY-MM-DD format');
    const year = parseInt(match[1], 10);
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      throw new BadRequestException(`dateOfBirth year must be between 1900 and ${currentYear}`);
    }
  }

  // ─── List cases by org (joined with patient name) ─────────────────────────

  async findAllByOrg(orgId: string, limit = 100, offset = 0) {
    const { rows } = await this.pool.query(
      `SELECT
         c.id, c.status, c.notes, c.chief_complaint, c.malocclusion_class,
         c.created_at, c.updated_at,
         p.id AS patient_id, p.first_name, p.last_name,
         au.full_name AS assigned_to_name, au.email AS assigned_to_email,
         au.id AS assigned_to_id
       FROM cases c
       JOIN patients p ON p.id = c.patient_id
       LEFT JOIN auth_users au ON au.id = c.assigned_to
       WHERE p.organization_id = $1
       ORDER BY c.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset],
    );
    return rows.map(this.formatCase);
  }

  // ─── Get single case with full details ────────────────────────────────────

  async findOne(id: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT
         c.id, c.status, c.notes, c.chief_complaint, c.malocclusion_class,
         c.created_at, c.updated_at,
         p.id AS patient_id, p.first_name, p.last_name,
         p.dob AS date_of_birth, p.gender, p.clinical_notes AS patient_notes,
         p.organization_id,
         au.full_name AS assigned_to_name, au.id AS assigned_to_id
       FROM cases c
       JOIN patients p ON p.id = c.patient_id
       LEFT JOIN auth_users au ON au.id = c.assigned_to
       WHERE c.id = $1`,
      [id],
    );

    const row = rows[0];
    if (!row) throw new NotFoundException(`Case ${id} not found`);
    if (row.organization_id !== orgId) {
      throw new ForbiddenException('Access denied to this case');
    }

    const history = await this.workflowService.getHistory(id);
    const allowedTransitions = this.workflowService.allowedTransitions(
      row.status as CaseStatus,
    );

    // Fetch linked resource IDs in a single query to avoid N+1.
    // Wrapped in try/catch so a missing table from an incomplete migration does not
    // prevent the case from loading at all.
    let linked: Record<string, unknown> = {};
    try {
      const { rows: linkedRows } = await this.pool.query(
        `SELECT
           (SELECT id FROM stl_uploads        WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1) AS latest_scan_id,
           (SELECT id FROM digital_setups     WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1) AS setup_id,
           (SELECT id FROM treatment_plans    WHERE patient_id = (SELECT patient_id FROM cases WHERE id = $1) ORDER BY created_at DESC LIMIT 1) AS plan_id,
           (SELECT id FROM clinical_analyses  WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1) AS analysis_id,
           (SELECT id FROM treatment_goals    WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1) AS goals_id`,
        [id],
      );
      linked = linkedRows[0] ?? {};
    } catch (e) {
      this.logger.warn(`Could not fetch linked resources for case ${id}: ${String(e)}`);
    }

    return {
      ...this.formatCase(row),
      patient: {
        id: row.patient_id,
        firstName: row.first_name,
        lastName: row.last_name,
        dateOfBirth: row.date_of_birth,
        gender: row.gender,
        clinicalNotes: row.patient_notes,
      },
      linkedResources: {
        latestScanId: (linked.latest_scan_id as string | null) ?? null,
        setupId:      (linked.setup_id      as string | null) ?? null,
        planId:       (linked.plan_id       as string | null) ?? null,
        analysisId:   (linked.analysis_id   as string | null) ?? null,
        goalsId:      (linked.goals_id      as string | null) ?? null,
      },
      workflowHistory: history,
      allowedTransitions,
    };
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(
    orgId: string,
    createdBy: string,
    dto: CreateCaseDto,
    opts: { actorEmail?: string; ipAddress?: string } = {},
  ) {
    // Verify patient belongs to org
    const { rows: patRows } = await this.pool.query(
      'SELECT id FROM patients WHERE id = $1 AND organization_id = $2',
      [dto.patientId, orgId],
    );
    if (!patRows[0]) {
      throw new ForbiddenException('Patient not found in this organization');
    }

    const { rows } = await this.pool.query(
      `INSERT INTO cases
         (patient_id, assigned_to, status, chief_complaint, malocclusion_class, notes)
       VALUES ($1, $2, 'draft', $3, $4, $5)
       RETURNING id`,
      [
        dto.patientId,
        createdBy,
        dto.chiefComplaint ?? null,
        dto.malocclusionClass ?? null,
        dto.notes ?? null,
      ],
    );

    const newId = rows[0].id as string;

    await this.auditService.log({
      organizationId: orgId,
      actorId: createdBy,
      actorEmail: opts.actorEmail,
      resourceType: 'case',
      resourceId: newId,
      action: 'case.created',
      details: dto,
      ipAddress: opts.ipAddress,
    });

    return this.findOne(newId, orgId);
  }

  // ─── Atomic create: new patient + case in one transaction ─────────────────

  async createWithNewPatient(
    orgId: string,
    actorId: string,
    dto: CreateCaseWithPatientDto,
    opts: { actorEmail?: string; ipAddress?: string } = {},
  ) {
    this.assertValidDob(dto.patient.dateOfBirth);

    const client: PoolClient = await this.pool.connect();
    let committed = false;
    let patientId: string;
    let caseId: string;

    try {
      await client.query('BEGIN');

      const { rows: patRows } = await client.query<{ id: string }>(
        `INSERT INTO patients
           (organization_id, first_name, last_name, dob, gender, clinical_notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          orgId,
          this.cryptoService.encrypt(dto.patient.firstName),
          this.cryptoService.encrypt(dto.patient.lastName),
          dto.patient.dateOfBirth ?? null,
          this.cryptoService.encrypt(dto.patient.gender ?? null),
          this.cryptoService.encrypt(dto.patient.clinicalNotes ?? null),
          actorId,
        ],
      );
      patientId = patRows[0].id;

      const { rows: caseRows } = await client.query<{ id: string }>(
        `INSERT INTO cases
           (patient_id, assigned_to, status, chief_complaint, malocclusion_class, notes)
         VALUES ($1, $2, 'draft', $3, $4, $5)
         RETURNING id`,
        [
          patientId,
          actorId,
          dto.chiefComplaint ?? null,
          dto.malocclusionClass ?? null,
          dto.notes ?? null,
        ],
      );
      caseId = caseRows[0].id;

      await client.query('COMMIT');
      committed = true;
    } catch (err) {
      if (!committed) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      }
      throw err;
    } finally {
      client.release();
    }

    await Promise.all([
      this.auditService.log({
        organizationId: orgId, actorId, actorEmail: opts.actorEmail,
        resourceType: 'patient', resourceId: patientId!,
        action: 'patient.created', details: { firstName: dto.patient.firstName, lastName: dto.patient.lastName },
        ipAddress: opts.ipAddress,
      }),
      this.auditService.log({
        organizationId: orgId, actorId, actorEmail: opts.actorEmail,
        resourceType: 'case', resourceId: caseId!,
        action: 'case.created', details: { patientId, chiefComplaint: dto.chiefComplaint },
        ipAddress: opts.ipAddress,
      }),
    ]);

    return this.findOne(caseId!, orgId);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(
    id: string,
    orgId: string,
    actorId: string,
    dto: UpdateCaseDto,
    opts: { actorEmail?: string; ipAddress?: string } = {},
  ) {
    await this.findOne(id, orgId); // ownership check

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (dto.chiefComplaint !== undefined) { fields.push(`chief_complaint = $${i++}`); values.push(dto.chiefComplaint); }
    if (dto.malocclusionClass !== undefined) { fields.push(`malocclusion_class = $${i++}`); values.push(dto.malocclusionClass); }
    if (dto.notes !== undefined) { fields.push(`notes = $${i++}`); values.push(dto.notes); }

    if (fields.length === 0) return this.findOne(id, orgId);

    fields.push(`updated_at = now()`);
    values.push(id);
    values.push(orgId);

    await this.pool.query(
      `UPDATE cases SET ${fields.join(', ')} WHERE id = $${i} AND patient_id IN (SELECT id FROM patients WHERE organization_id = $${i + 1})`,
      values,
    );

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      actorEmail: opts.actorEmail,
      resourceType: 'case',
      resourceId: id,
      action: 'case.updated',
      details: dto,
      ipAddress: opts.ipAddress,
    });

    return this.findOne(id, orgId);
  }

  // ─── Status transition ────────────────────────────────────────────────────

  async transition(
    id: string,
    orgId: string,
    actorId: string,
    actorRole: string,
    toStatus: CaseStatus,
    notes?: string,
    opts: { actorEmail?: string; ipAddress?: string } = {},
  ) {
    await this.findOne(id, orgId); // ownership check
    return this.workflowService.transition({
      caseId: id,
      toStatus,
      actorId,
      actorRole,
      orgId,
      actorEmail: opts.actorEmail,
      notes,
      ipAddress: opts.ipAddress,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private formatCase(row: Record<string, unknown>) {
    return {
      id: row['id'],
      status: row['status'],
      chiefComplaint: row['chief_complaint'],
      malocclusionClass: row['malocclusion_class'],
      notes: row['notes'],
      createdAt: row['created_at'],
      updatedAt: row['updated_at'],
      patient: {
        id: row['patient_id'],
        firstName: row['first_name'],
        lastName: row['last_name'],
      },
      assignedTo: row['assigned_to_id']
        ? { id: row['assigned_to_id'], name: row['assigned_to_name'], email: row['assigned_to_email'] }
        : null,
    };
  }
}
