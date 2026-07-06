import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as path from 'path';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export const PHOTO_TYPES = [
  'frontal_rest', 'frontal_smile', 'profile_rest', 'profile_smile',
  'three_quarter', 'three_quarter_smile',
  'intraoral_frontal', 'intraoral_upper_occlusal', 'intraoral_lower_occlusal',
  'buccal_left', 'buccal_right', 'buccal_both',
  'panoramic', 'lateral_ceph', 'other',
] as const;
export type PhotoType = typeof PHOTO_TYPES[number];

export interface PatientPhoto {
  id: string;
  caseId: string;
  photoType: PhotoType;
  filePath: string;
  fileSizeBytes: number;
  originalFilename: string | null;
  takenAt: string | null;
  notes: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
}

export interface UploadPhotoDto {
  photoType: PhotoType;
  filePath: string;
  fileSizeBytes: number;
  originalFilename?: string;
  takenAt?: string;
  notes?: string;
  uploadedBy: string;
}

@Injectable()
export class PhotosService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async verifyCase(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT id FROM cases WHERE id = $1 AND organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows.length) throw new ForbiddenException('Case not found or access denied');
  }

  async list(caseId: string, orgId: string): Promise<PatientPhoto[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT pp.id, pp.case_id, pp.photo_type, pp.file_path,
              pp.file_size_bytes, pp.original_filename, pp.taken_at,
              pp.notes, pp.created_at,
              u.email AS uploaded_by_email
       FROM patient_photos pp
       LEFT JOIN auth_users u ON u.id = pp.uploaded_by
       WHERE pp.case_id = $1
       ORDER BY pp.photo_type, pp.created_at DESC`,
      [caseId],
    );
    return rows.map(this.format);
  }

  async create(caseId: string, orgId: string, dto: UploadPhotoDto): Promise<PatientPhoto> {
    await this.verifyCase(caseId, orgId);
    const uploadRoot = path.resolve(process.env.UPLOADS_DIR ?? '/uploads');
    const resolved = path.resolve(dto.filePath);
    if (!resolved.startsWith(uploadRoot + path.sep) && resolved !== uploadRoot) {
      throw new BadRequestException('Invalid file path');
    }
    const { rows } = await this.pool.query(
      `INSERT INTO patient_photos
         (case_id, photo_type, file_path, file_size_bytes,
          original_filename, taken_at, notes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT id FROM auth_users WHERE id::text=$8 OR email=$8 LIMIT 1))
       RETURNING *,
         (SELECT email FROM auth_users WHERE id = uploaded_by) AS uploaded_by_email`,
      [
        caseId,
        dto.photoType,
        dto.filePath,
        dto.fileSizeBytes,
        dto.originalFilename ?? null,
        dto.takenAt ?? null,
        dto.notes ?? null,
        dto.uploadedBy,
      ],
    );
    return this.format(rows[0]);
  }

  async delete(caseId: string, orgId: string, photoId: string): Promise<void> {
    await this.verifyCase(caseId, orgId);
    const { rowCount } = await this.pool.query(
      `DELETE FROM patient_photos WHERE id = $1 AND case_id = $2`,
      [photoId, caseId],
    );
    if (!rowCount) throw new NotFoundException('Photo not found');
  }

  private format(row: any): PatientPhoto {
    return {
      id: row.id,
      caseId: row.case_id,
      photoType: row.photo_type,
      filePath: row.file_path,
      fileSizeBytes: row.file_size_bytes,
      originalFilename: row.original_filename ?? null,
      takenAt: row.taken_at ?? null,
      notes: row.notes ?? null,
      uploadedByEmail: row.uploaded_by_email ?? null,
      createdAt: row.created_at,
    };
  }
}
