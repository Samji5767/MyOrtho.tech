import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface PatientNote {
  id: string; patientId: string; authorId: string; noteType: string;
  content: string; isPinned: boolean; createdAt: string;
}

@Injectable()
export class CrmService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listNotes(patientId: string, orgId: string): Promise<PatientNote[]> {
    await this.verifyPatient(patientId, orgId);
    const { rows } = await this.db.query(
      `SELECT * FROM patient_notes WHERE patient_id=$1 AND organization_id=$2
       ORDER BY is_pinned DESC, created_at DESC LIMIT 100`,
      [patientId, orgId],
    );
    return rows.map(this.mapNote);
  }

  async addNote(orgId: string, patientId: string, authorId: string, dto: {
    noteType?: string; content: string; isPinned?: boolean;
  }): Promise<PatientNote> {
    await this.verifyPatient(patientId, orgId);
    const { rows } = await this.db.query(
      `INSERT INTO patient_notes (organization_id, patient_id, author_id, note_type, content, is_pinned)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, patientId, authorId, dto.noteType ?? 'general', dto.content, dto.isPinned ?? false],
    );
    return this.mapNote(rows[0]);
  }

  async pinNote(noteId: string, orgId: string, pinned: boolean): Promise<PatientNote> {
    const { rows } = await this.db.query(
      'UPDATE patient_notes SET is_pinned=$2, updated_at=now() WHERE id=$1 AND organization_id=$3 RETURNING *',
      [noteId, pinned, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Note not found');
    return this.mapNote(rows[0]);
  }

  async getTags(patientId: string, orgId: string): Promise<string[]> {
    const { rows } = await this.db.query(
      'SELECT tag FROM patient_tags WHERE patient_id=$1 AND organization_id=$2 ORDER BY tag',
      [patientId, orgId],
    );
    return rows.map(r => r['tag'] as string);
  }

  async addTag(orgId: string, patientId: string, createdBy: string, tag: string): Promise<void> {
    await this.verifyPatient(patientId, orgId);
    await this.db.query(
      `INSERT INTO patient_tags (organization_id, patient_id, tag, created_by) VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [orgId, patientId, tag.toLowerCase().trim(), createdBy],
    );
  }

  async removeTag(orgId: string, patientId: string, tag: string): Promise<void> {
    await this.db.query(
      'DELETE FROM patient_tags WHERE organization_id=$1 AND patient_id=$2 AND tag=$3',
      [orgId, patientId, tag.toLowerCase().trim()],
    );
  }

  async searchPatientsByTag(orgId: string, tag: string): Promise<{ patientId: string; tag: string }[]> {
    const { rows } = await this.db.query(
      'SELECT patient_id, tag FROM patient_tags WHERE organization_id=$1 AND tag=$2 LIMIT 100',
      [orgId, tag.toLowerCase().trim()],
    );
    return rows.map(r => ({ patientId: r['patient_id'] as string, tag: r['tag'] as string }));
  }

  private async verifyPatient(patientId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query('SELECT id FROM patients WHERE id=$1 AND organization_id=$2', [patientId, orgId]);
    if (!rows[0]) throw new NotFoundException('Patient not found');
  }

  private mapNote(r: Record<string, unknown>): PatientNote {
    return {
      id: r['id'] as string, patientId: r['patient_id'] as string,
      authorId: r['author_id'] as string, noteType: r['note_type'] as string,
      content: r['content'] as string, isPinned: r['is_pinned'] as boolean,
      createdAt: String(r['created_at']),
    };
  }
}
