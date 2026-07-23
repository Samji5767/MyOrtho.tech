import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../common/crypto.service';

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  gender?: string;

  @IsString()
  @IsOptional()
  clinicalNotes?: string;
}

export interface TimelineEvent {
  id: string;
  type: string;
  label: string;
  detail?: string;
  actor?: string;
  caseId?: string;
  occurredAt: string;
}

export class UpdatePatientDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  gender?: string;

  @IsString()
  @IsOptional()
  clinicalNotes?: string;
}

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
    private readonly cryptoService: CryptoService,
  ) {}

  async findAllByOrg(orgId: string, limit = 100, offset = 0) {
    const { rows } = await this.pool.query(
      `SELECT
         p.id, p.first_name, p.last_name, p.dob AS date_of_birth, p.dob_encrypted, p.gender,
         p.created_at, p.updated_at,
         COUNT(c.id)::int AS case_count
       FROM patients p
       LEFT JOIN cases c ON c.patient_id = p.id
       WHERE p.organization_id = $1
       GROUP BY p.id
       ORDER BY p.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset],
    );
    return rows.map(row => this.formatPatient(row, true));
  }

  async findOne(id: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.dob AS date_of_birth, p.dob_encrypted, p.gender,
              p.clinical_notes, p.organization_id, p.created_at, p.updated_at,
              COUNT(c.id)::int AS case_count
       FROM patients p
       LEFT JOIN cases c ON c.patient_id = p.id
       WHERE p.id = $1 AND p.organization_id = $2
       GROUP BY p.id`,
      [id, orgId],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException(`Patient ${id} not found`);
    return this.formatPatient(row, true);
  }

  private assertValidDob(dob: string | undefined): void {
    if (!dob) return;
    const match = /^(\d{4})-\d{2}-\d{2}$/.exec(dob);
    if (!match) {
      throw new BadRequestException('dateOfBirth must be in YYYY-MM-DD format');
    }
    const year = parseInt(match[1], 10);
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      throw new BadRequestException(`dateOfBirth year must be between 1900 and ${currentYear}`);
    }
  }

  // ─── Workspace-scoped list (preferred over org-scoped for new code) ──────────

  async findAllByWorkspace(workspaceId: string, limit = 100, offset = 0, includeArchived = false) {
    const archiveFilter = includeArchived ? '' : `AND p.status != 'archived'`;
    const { rows } = await this.pool.query(
      `SELECT
         p.id, p.first_name, p.last_name, p.dob_encrypted, p.gender,
         p.status, p.archived_at, p.created_at, p.updated_at,
         COUNT(c.id)::int AS case_count
       FROM patients p
       LEFT JOIN cases c ON c.patient_id = p.id
       WHERE p.workspace_id = $1 ${archiveFilter}
       GROUP BY p.id
       ORDER BY p.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset],
    );
    return rows.map(row => this.formatPatient(row, true));
  }

  async findOneByWorkspace(id: string, workspaceId: string) {
    const { rows } = await this.pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.dob_encrypted, p.gender,
              p.clinical_notes, p.organization_id, p.workspace_id,
              p.status, p.archived_at, p.created_at, p.updated_at,
              COUNT(c.id)::int AS case_count
       FROM patients p
       LEFT JOIN cases c ON c.patient_id = p.id
       WHERE p.id = $1 AND p.workspace_id = $2
       GROUP BY p.id`,
      [id, workspaceId],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException(`Patient not found`);
    return this.formatPatient(row, true);
  }

  // ─── Archive / restore ────────────────────────────────────────────────────

  async archive(
    patientId: string,
    workspaceId: string,
    actorId: string,
    opts: { actorEmail?: string; ipAddress?: string } = {},
  ) {
    await this.findOneByWorkspace(patientId, workspaceId); // IDOR + existence check

    await this.pool.query(
      `UPDATE patients SET status = 'archived', archived_at = now(), updated_at = now()
       WHERE id = $1 AND workspace_id = $2`,
      [patientId, workspaceId],
    );

    const patient = await this.findOneByWorkspace(patientId, workspaceId);

    await this.auditService.log({
      organizationId: patient.organizationId as string,
      actorId,
      actorEmail: opts.actorEmail,
      resourceType: 'patient',
      resourceId: patientId,
      action: 'patient.archived',
      details: { patientId },
      ipAddress: opts.ipAddress,
    });

    return patient;
  }

  async restore(
    patientId: string,
    workspaceId: string,
    actorId: string,
    opts: { actorEmail?: string; ipAddress?: string } = {},
  ) {
    const { rows } = await this.pool.query(
      `SELECT id, organization_id FROM patients WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [patientId, workspaceId],
    );
    if (!rows[0]) throw new NotFoundException(`Patient not found`);

    await this.pool.query(
      `UPDATE patients SET status = 'active', archived_at = NULL, updated_at = now()
       WHERE id = $1 AND workspace_id = $2`,
      [patientId, workspaceId],
    );

    await this.auditService.log({
      organizationId: rows[0].organization_id as string,
      actorId,
      actorEmail: opts.actorEmail,
      resourceType: 'patient',
      resourceId: patientId,
      action: 'patient.restored',
      details: { patientId },
      ipAddress: opts.ipAddress,
    });

    return this.findOneByWorkspace(patientId, workspaceId);
  }

  async create(
    orgId: string,
    createdBy: string,
    dto: CreatePatientDto,
    opts: { actorEmail?: string; ipAddress?: string; workspaceId?: string | null } = {},
  ) {
    this.assertValidDob(dto.dateOfBirth);
    const { rows } = await this.pool.query(
      `INSERT INTO patients
         (organization_id, workspace_id, first_name, last_name, dob_encrypted, gender, clinical_notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        orgId,
        opts.workspaceId ?? null,
        this.cryptoService.encrypt(dto.firstName),
        this.cryptoService.encrypt(dto.lastName),
        this.cryptoService.encrypt(dto.dateOfBirth ?? null),
        this.cryptoService.encrypt(dto.gender ?? null),
        this.cryptoService.encrypt(dto.clinicalNotes ?? null),
        createdBy,
      ],
    );

    const newId = rows[0].id as string;

    await this.auditService.log({
      organizationId: orgId,
      actorId: createdBy,
      actorEmail: opts.actorEmail,
      resourceType: 'patient',
      resourceId: newId,
      action: 'patient.created',
      // Audit record must not contain PHI
      details: { patientId: newId },
      ipAddress: opts.ipAddress,
    });

    return this.findOne(newId, orgId);
  }

  async update(
    id: string,
    orgId: string,
    actorId: string,
    dto: UpdatePatientDto,
    opts: { actorEmail?: string; ipAddress?: string } = {},
  ) {
    this.assertValidDob(dto.dateOfBirth);
    await this.findOne(id, orgId); // ownership check

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (dto.firstName !== undefined)    { fields.push(`first_name = $${i++}`);    values.push(this.cryptoService.encrypt(dto.firstName)); }
    if (dto.lastName !== undefined)     { fields.push(`last_name = $${i++}`);     values.push(this.cryptoService.encrypt(dto.lastName)); }
    if (dto.dateOfBirth !== undefined) {
      fields.push(`dob_encrypted = $${i++}`);
      values.push(this.cryptoService.encrypt(dto.dateOfBirth ?? null));
    }
    if (dto.gender !== undefined)       { fields.push(`gender = $${i++}`);        values.push(this.cryptoService.encrypt(dto.gender)); }
    if (dto.clinicalNotes !== undefined){ fields.push(`clinical_notes = $${i++}`); values.push(this.cryptoService.encrypt(dto.clinicalNotes)); }

    if (fields.length === 0) return this.findOne(id, orgId);

    fields.push(`updated_at = now()`);
    values.push(id);
    values.push(orgId);

    await this.pool.query(
      `UPDATE patients SET ${fields.join(', ')} WHERE id = $${i} AND organization_id = $${i + 1}`,
      values,
    );

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      actorEmail: opts.actorEmail,
      resourceType: 'patient',
      resourceId: id,
      action: 'patient.updated',
      // Audit record must not contain PHI field values
      details: { fields: Object.keys(dto) },
      ipAddress: opts.ipAddress,
    });

    return this.findOne(id, orgId);
  }

  // ─── Patient Timeline ─────────────────────────────────────────────────────

  async getTimeline(patientId: string, orgId: string): Promise<TimelineEvent[]> {
    await this.findOne(patientId, orgId); // ownership + existence check

    const [casesRes, scansRes, appointmentsRes, notesRes] = await Promise.all([
      // Cases with workflow event history (workflow_events is the actual table name)
      this.pool.query(
        `SELECT c.id, c.status, c.created_at, c.updated_at,
                we.from_status, we.to_status, we.notes, we.created_at AS wh_at
         FROM cases c
         LEFT JOIN workflow_events we ON we.case_id = c.id
         WHERE c.patient_id = $1 AND c.patient_id IN (
           SELECT id FROM patients WHERE organization_id = $2
         )
         ORDER BY COALESCE(we.created_at, c.created_at) DESC
         LIMIT 200`,
        [patientId, orgId],
      ),
      // Scans
      this.pool.query(
        `SELECT s.id, s.jaw_type, s.file_format, s.created_at, s.case_id
         FROM scans s
         JOIN cases c ON c.id = s.case_id
         WHERE c.patient_id = $1 AND c.patient_id IN (
           SELECT id FROM patients WHERE organization_id = $2
         )
         ORDER BY s.created_at DESC LIMIT 100`,
        [patientId, orgId],
      ),
      // Appointments
      this.pool.query(
        `SELECT id, visit_reason, scheduled_at, status
         FROM appointments
         WHERE patient_id = $1
         ORDER BY scheduled_at DESC LIMIT 50`,
        [patientId],
      ),
      // Manual timeline notes
      this.pool.query(
        `SELECT id, note, event_type, event_at, case_id, author_id
         FROM patient_timeline_notes
         WHERE patient_id = $1 AND organization_id = $2
         ORDER BY event_at DESC LIMIT 50`,
        [patientId, orgId],
      ),
    ]);

    const events: TimelineEvent[] = [];

    for (const row of casesRes.rows) {
      const caseId = row['id'] as string;
      if (row['wh_at']) {
        events.push({
          id: `wh-${caseId}-${String(row['wh_at'])}`,
          type: 'case_transition',
          label: row['from_status']
            ? `Case moved: ${row['from_status']} → ${row['to_status']}`
            : `Case created: ${row['to_status']}`,
          detail: (row['notes'] as string | null) ?? undefined,
          actor: (row['actor_name'] as string | null) ?? undefined,
          caseId,
          occurredAt: String(row['wh_at']),
        });
      } else if (!row['wh_at'] && row['created_at']) {
        events.push({
          id: `case-${caseId}`,
          type: 'case_created',
          label: 'Case opened',
          detail: `Status: ${row['status']}`,
          caseId,
          occurredAt: String(row['created_at']),
        });
      }
    }

    for (const row of scansRes.rows) {
      events.push({
        id: `scan-${row['id']}`,
        type: 'scan_uploaded',
        label: `${String(row['jaw_type']).charAt(0).toUpperCase() + String(row['jaw_type']).slice(1)} scan uploaded`,
        detail: `Format: ${row['file_format']}`,
        caseId: row['case_id'] as string,
        occurredAt: String(row['created_at']),
      });
    }

    for (const row of appointmentsRes.rows) {
      events.push({
        id: `appt-${row['id']}`,
        type: row['status'] === 'completed' ? 'appointment_completed'
          : row['status'] === 'canceled' ? 'appointment_cancelled'
          : 'appointment_scheduled',
        label: String(row['visit_reason']),
        detail: `Status: ${row['status']}`,
        occurredAt: String(row['scheduled_at']),
      });
    }

    for (const row of notesRes.rows) {
      events.push({
        id: `note-${row['id']}`,
        type: (row['event_type'] as string) || 'note',
        label: 'Clinical note',
        detail: row['note'] as string,
        caseId: (row['case_id'] as string | null) ?? undefined,
        occurredAt: String(row['event_at']),
      });
    }

    return events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  async addTimelineNote(
    patientId: string,
    orgId: string,
    authorId: string,
    dto: { note: string; caseId?: string; eventType?: string; eventAt?: string },
  ): Promise<TimelineEvent> {
    await this.findOne(patientId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO patient_timeline_notes
         (organization_id, patient_id, case_id, author_id, note, event_type, event_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
       RETURNING *`,
      [orgId, patientId, dto.caseId ?? null, authorId, dto.note, dto.eventType ?? 'note', dto.eventAt ?? null],
    );
    const r = rows[0];
    return {
      id: `note-${r['id']}`,
      type: r['event_type'] as string,
      label: 'Clinical note',
      detail: r['note'] as string,
      caseId: (r['case_id'] as string | null) ?? undefined,
      occurredAt: String(r['event_at']),
    };
  }

  private formatPatient(row: Record<string, unknown>, decrypt = false) {
    const firstName = decrypt
      ? this.cryptoService.decrypt(row['first_name'] as string | null)
      : row['first_name'];
    const lastName = decrypt
      ? this.cryptoService.decrypt(row['last_name'] as string | null)
      : row['last_name'];
    const gender = decrypt
      ? this.cryptoService.decrypt(row['gender'] as string | null)
      : row['gender'];
    const clinicalNotes = decrypt
      ? this.cryptoService.decrypt(row['clinical_notes'] as string | null)
      : row['clinical_notes'];

    const rawDobEncrypted = row['dob_encrypted'] as string | null | undefined;
    const dateOfBirth = decrypt && rawDobEncrypted
      ? this.cryptoService.decrypt(rawDobEncrypted)
      : (row['date_of_birth'] as string | null) ?? null;

    return {
      id: row['id'],
      firstName,
      lastName,
      fullName: `${firstName ?? ''} ${lastName ?? ''}`.trim(),
      dateOfBirth,
      gender,
      clinicalNotes,
      status: (row['status'] as string | null) ?? 'active',
      archivedAt: row['archived_at'] ?? null,
      caseCount: row['case_count'] ?? 0,
      organizationId: row['organization_id'],
      workspaceId: row['workspace_id'] ?? null,
      createdAt: row['created_at'],
      updatedAt: row['updated_at'],
    };
  }
}
