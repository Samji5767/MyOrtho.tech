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

  async create(
    orgId: string,
    createdBy: string,
    dto: CreatePatientDto,
    opts: { actorEmail?: string; ipAddress?: string } = {},
  ) {
    this.assertValidDob(dto.dateOfBirth);
    const { rows } = await this.pool.query(
      `INSERT INTO patients
         (organization_id, first_name, last_name, dob_encrypted, gender, clinical_notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        orgId,
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
      caseCount: row['case_count'] ?? 0,
      organizationId: row['organization_id'],
      createdAt: row['created_at'],
      updatedAt: row['updated_at'],
    };
  }
}
