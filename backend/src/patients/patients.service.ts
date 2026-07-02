import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../common/crypto.service';

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  clinicalNotes?: string;
}

export interface UpdatePatientDto {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
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
         p.id, p.first_name, p.last_name, p.dob AS date_of_birth, p.gender,
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
      `SELECT p.id, p.first_name, p.last_name, p.dob AS date_of_birth, p.gender,
              p.clinical_notes, p.organization_id, p.created_at, p.updated_at,
              COUNT(c.id)::int AS case_count
       FROM patients p
       LEFT JOIN cases c ON c.patient_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException(`Patient ${id} not found`);
    if (row.organization_id !== orgId) {
      throw new ForbiddenException('Access denied');
    }
    return this.formatPatient(row, true);
  }

  async create(
    orgId: string,
    createdBy: string,
    dto: CreatePatientDto,
    opts: { actorEmail?: string; ipAddress?: string } = {},
  ) {
    const { rows } = await this.pool.query(
      `INSERT INTO patients
         (organization_id, first_name, last_name, dob, gender, clinical_notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        orgId,
        this.cryptoService.encrypt(dto.firstName),
        this.cryptoService.encrypt(dto.lastName),
        dto.dateOfBirth ?? null,
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
    await this.findOne(id, orgId); // ownership check

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (dto.firstName !== undefined)    { fields.push(`first_name = $${i++}`);    values.push(this.cryptoService.encrypt(dto.firstName)); }
    if (dto.lastName !== undefined)     { fields.push(`last_name = $${i++}`);     values.push(this.cryptoService.encrypt(dto.lastName)); }
    if (dto.dateOfBirth !== undefined)  { fields.push(`dob = $${i++}`);           values.push(dto.dateOfBirth); }
    if (dto.gender !== undefined)       { fields.push(`gender = $${i++}`);        values.push(this.cryptoService.encrypt(dto.gender)); }
    if (dto.clinicalNotes !== undefined){ fields.push(`clinical_notes = $${i++}`); values.push(this.cryptoService.encrypt(dto.clinicalNotes)); }

    if (fields.length === 0) return this.findOne(id, orgId);

    fields.push(`updated_at = now()`);
    values.push(id);

    await this.pool.query(
      `UPDATE patients SET ${fields.join(', ')} WHERE id = $${i}`,
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

    return {
      id: row['id'],
      firstName,
      lastName,
      fullName: `${firstName ?? ''} ${lastName ?? ''}`.trim(),
      dateOfBirth: row['date_of_birth'],
      gender,
      clinicalNotes,
      caseCount: row['case_count'] ?? 0,
      organizationId: row['organization_id'],
      createdAt: row['created_at'],
      updatedAt: row['updated_at'],
    };
  }
}
