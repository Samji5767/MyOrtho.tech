import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../common/crypto.service';
import { WorkflowService, type CaseStatus } from '../workflow/workflow.service';
import { NotificationsService, type NotificationType } from '../notifications/notifications.service';

export class CreateCaseDto {
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @IsString()
  @IsOptional()
  malocclusionClass?: string;

  @IsString()
  @IsOptional()
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

export interface PracticeAnalyticsSummary {
  totalCases: number;
  activeCases: number;
  pendingReview: number;
  completedThisMonth: number;
  manufacturingQueue: number;
  archivedCases: number;
  draftCases: number;
}

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
    private readonly workflowService: WorkflowService,
    private readonly cryptoService: CryptoService,
    private readonly notificationsService: NotificationsService,
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
       WHERE c.id = $1 AND p.organization_id = $2`,
      [id, orgId],
    );

    const row = rows[0];
    if (!row) throw new NotFoundException(`Case ${id} not found`);

    const allowedTransitions = this.workflowService.allowedTransitions(
      row.status as CaseStatus,
    );

    // Run history fetch and linked resource lookup concurrently to avoid sequential round-trips.
    // The linked-resource fetch is wrapped in an async IIFE so that both synchronous mock
    // returns and real Promise returns work correctly, and errors are caught either way.
    const [history, linked] = await Promise.all([
      this.workflowService.getHistory(id),
      (async (): Promise<Record<string, unknown>> => {
        try {
          const { rows } = await this.pool.query(
            `SELECT
               (SELECT id FROM scans              WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1) AS latest_scan_id,
               (SELECT id FROM digital_setups     WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1) AS setup_id,
               (SELECT id FROM treatment_plans    WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1) AS plan_id,
               (SELECT id FROM clinical_analyses  WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1) AS analysis_id,
               (SELECT id FROM treatment_goals    WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1) AS goals_id`,
            [id],
          );
          return rows[0] ?? {};
        } catch (e) {
          this.logger.warn(`Could not fetch linked resources for case ${id}: ${String(e)}`);
          return {};
        }
      })(),
    ]);

    return {
      ...this.formatCase(row),
      patient: {
        id: row.patient_id,
        firstName: this.cryptoService.decrypt(row.first_name as string | null),
        lastName:  this.cryptoService.decrypt(row.last_name  as string | null),
        dateOfBirth: row.date_of_birth,
        gender:      this.cryptoService.decrypt(row.gender as string | null),
        clinicalNotes: this.cryptoService.decrypt(row.patient_notes as string | null),
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
    const client: PoolClient = await this.pool.connect();
    let newId: string;
    try {
      await client.query('BEGIN');

      // Verify patient belongs to org
      const { rows: patRows } = await client.query(
        'SELECT id FROM patients WHERE id = $1 AND organization_id = $2',
        [dto.patientId, orgId],
      );
      if (!patRows[0]) {
        throw new ForbiddenException('Patient not found in this organization');
      }

      const { rows } = await client.query(
        `INSERT INTO cases
           (patient_id, assigned_to, organization_id, status, chief_complaint, malocclusion_class, notes)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6)
         RETURNING id`,
        [
          dto.patientId,
          createdBy,
          orgId,
          dto.chiefComplaint ?? null,
          dto.malocclusionClass ?? null,
          dto.notes ?? null,
        ],
      );

      newId = rows[0].id as string;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Best-effort post-creation setup: treatment plan + initial workflow event.
    // Failures here must not roll back the committed case.
    await Promise.allSettled([
      this.pool.query(
        `INSERT INTO treatment_plans (case_id, created_by) VALUES ($1, NULL) ON CONFLICT DO NOTHING`,
        [newId],
      ),
      this.pool.query(
        `INSERT INTO workflow_events (case_id, from_status, to_status, actor_id, actor_role, notes)
         VALUES ($1, NULL, 'draft', $2, 'system', 'Case created')`,
        [newId, createdBy],
      ),
      this.auditService.log({
        organizationId: orgId,
        actorId: createdBy,
        actorEmail: opts.actorEmail,
        resourceType: 'case',
        resourceId: newId,
        action: 'case.created',
        details: dto,
        ipAddress: opts.ipAddress,
      }),
    ]);

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
           (patient_id, assigned_to, organization_id, status, chief_complaint, malocclusion_class, notes)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6)
         RETURNING id`,
        [
          patientId,
          actorId,
          orgId,
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

    // Best-effort post-creation setup: treatment plan + initial workflow event + audit.
    await Promise.allSettled([
      this.pool.query(
        `INSERT INTO treatment_plans (case_id, created_by) VALUES ($1, NULL) ON CONFLICT DO NOTHING`,
        [caseId!],
      ),
      this.pool.query(
        `INSERT INTO workflow_events (case_id, from_status, to_status, actor_id, actor_role, notes)
         VALUES ($1, NULL, 'draft', $2, 'system', 'Case created')`,
        [caseId!, actorId],
      ),
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
    const result = await this.workflowService.transition({
      caseId: id,
      toStatus,
      actorId,
      actorRole,
      orgId,
      actorEmail: opts.actorEmail,
      notes,
      ipAddress: opts.ipAddress,
    });

    // Fire notifications for key transitions — best-effort, never blocks the response
    const notifyStatuses: CaseStatus[] = ['approved', 'clinical_review', 'active_treatment'];
    if (notifyStatuses.includes(toStatus)) {
      void this.fireTransitionNotification(id, orgId, toStatus).catch((err) => {
        this.logger.warn(`Notification dispatch failed for case ${id} → ${toStatus}: ${String(err)}`);
      });
    }

    return result;
  }

  // ─── Analytics summary ────────────────────────────────────────────────────

  async getAnalyticsSummary(orgId: string): Promise<PracticeAnalyticsSummary> {
    const { rows } = await this.pool.query<{
      total_cases: string;
      active_cases: string;
      pending_review: string;
      completed_this_month: string;
      manufacturing_queue: string;
      archived_cases: string;
      draft_cases: string;
    }>(
      `SELECT
         COUNT(*)                                                          AS total_cases,
         COUNT(*) FILTER (WHERE status IN (
           'scan_review','segmentation','planning',
           'clinical_review','approved','active_treatment','monitoring'
         ))                                                                AS active_cases,
         COUNT(*) FILTER (WHERE status IN ('clinical_review','scan_review'))
                                                                          AS pending_review,
         COUNT(*) FILTER (WHERE status = 'completed'
           AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', NOW()))
                                                                          AS completed_this_month,
         COUNT(*) FILTER (WHERE status IN ('approved','active_treatment'))
                                                                          AS manufacturing_queue,
         COUNT(*) FILTER (WHERE status = 'archived')                      AS archived_cases,
         COUNT(*) FILTER (WHERE status = 'draft')                         AS draft_cases
       FROM cases
       WHERE organization_id = $1`,
      [orgId],
    );
    const row = rows[0];
    return {
      totalCases:         Number(row?.total_cases          ?? 0),
      activeCases:        Number(row?.active_cases         ?? 0),
      pendingReview:      Number(row?.pending_review       ?? 0),
      completedThisMonth: Number(row?.completed_this_month ?? 0),
      manufacturingQueue: Number(row?.manufacturing_queue  ?? 0),
      archivedCases:      Number(row?.archived_cases       ?? 0),
      draftCases:         Number(row?.draft_cases          ?? 0),
    };
  }

  // ─── Notification dispatch ────────────────────────────────────────────────

  private async fireTransitionNotification(
    caseId: string,
    orgId: string,
    toStatus: CaseStatus,
  ): Promise<void> {
    const { rows } = await this.pool.query<{ created_by: string | null }>(
      'SELECT created_by FROM cases WHERE id = $1',
      [caseId],
    );
    const userId = rows[0]?.created_by;
    if (!userId) return;

    const NOTIFICATION_MAP: Partial<Record<CaseStatus, { type: NotificationType; title: string; body: string }>> = {
      approved:         { type: 'case_approved',  title: 'Case Approved',     body: 'Case is ready for manufacturing' },
      clinical_review:  { type: 'case_submitted', title: 'Review Required',   body: 'A case needs clinical review' },
      active_treatment: { type: 'plan_ready',     title: 'Treatment Active',  body: 'Treatment has started for a patient' },
    };

    const n = NOTIFICATION_MAP[toStatus];
    if (!n) return;

    await this.notificationsService.create({ userId, orgId, type: n.type, title: n.title, body: n.body });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private formatCase = (row: Record<string, unknown>) => {
    const firstName = this.cryptoService.decrypt(row['first_name'] as string | null);
    const lastName  = this.cryptoService.decrypt(row['last_name']  as string | null);
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
        firstName,
        lastName,
      },
      assignedTo: row['assigned_to_id']
        ? { id: row['assigned_to_id'], name: row['assigned_to_name'], email: row['assigned_to_email'] }
        : null,
    };
  };
}
