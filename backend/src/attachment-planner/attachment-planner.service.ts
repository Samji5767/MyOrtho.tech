import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// Attachment auto-recommendation rules based on movement type/magnitude.
// Types: vertical_rectangular, horizontal_rectangular, optimized,
//        rotation, extrusion, root_control, retention, beveled

interface MovementMap {
  [fdi: string]: {
    mesialMm?: number; distalMm?: number;
    buccalMm?: number; lingualMm?: number;
    intrusionMm?: number; extrusionMm?: number;
    torqueDeg?: number; tipDeg?: number; rotationDeg?: number;
  };
}

type AttachmentType =
  | 'vertical_rectangular' | 'horizontal_rectangular' | 'optimized'
  | 'rotation' | 'extrusion' | 'root_control' | 'retention' | 'beveled';

interface AttachmentRec {
  fdi: number;
  type: AttachmentType;
  surface: 'buccal' | 'lingual' | 'occlusal';
  reason: string;
}

function recommendAttachments(totals: MovementMap): AttachmentRec[] {
  const recs: AttachmentRec[] = [];
  for (const [fdiStr, mv] of Object.entries(totals)) {
    const fdi = Number(fdiStr);
    const torque = Math.abs(mv.torqueDeg ?? 0);
    const tip    = Math.abs(mv.tipDeg ?? 0);
    const rot    = Math.abs(mv.rotationDeg ?? 0);
    const ext    = mv.extrusionMm ?? 0;
    const intr   = Math.abs(mv.intrusionMm ?? 0);
    const transl = Math.max(
      Math.abs(mv.mesialMm ?? 0), Math.abs(mv.distalMm ?? 0),
      Math.abs(mv.buccalMm ?? 0), Math.abs(mv.lingualMm ?? 0),
    );

    if (torque > 5 || tip > 5) {
      recs.push({ fdi, type: 'root_control', surface: 'buccal',
        reason: `Torque ${torque.toFixed(1)}° or tip ${tip.toFixed(1)}° exceeds root-control threshold` });
    }
    if (rot > 10) {
      recs.push({ fdi, type: 'rotation', surface: 'buccal',
        reason: `Rotation ${rot.toFixed(1)}° > 10° threshold` });
    }
    if (ext > 1.0) {
      recs.push({ fdi, type: 'extrusion', surface: 'buccal',
        reason: `Extrusion ${ext.toFixed(2)} mm > 1.0 mm threshold` });
    }
    if (intr > 0.8) {
      recs.push({ fdi, type: 'vertical_rectangular', surface: 'buccal',
        reason: `Intrusion ${intr.toFixed(2)} mm > 0.8 mm threshold — vertical attachment improves force vector` });
    }
    if (transl > 2.0 && torque <= 5 && tip <= 5) {
      recs.push({ fdi, type: 'optimized', surface: 'buccal',
        reason: `Translation ${transl.toFixed(2)} mm — optimized attachment for bodily movement` });
    }
    if (transl > 0.3 && rot > 3 && rot <= 10) {
      recs.push({ fdi, type: 'horizontal_rectangular', surface: 'buccal',
        reason: `Moderate rotation ${rot.toFixed(1)}° with translation — horizontal attachment` });
    }
  }
  return recs;
}

export interface CreateAttachmentDto {
  fdiNumber: number;
  attachmentType: AttachmentType;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  surface?: 'buccal' | 'lingual' | 'occlusal';
  activationStage?: number;
  deactivationStage?: number | null;
  notes?: string | null;
}

@Injectable()
export class AttachmentPlannerService {
  private readonly logger = new Logger(AttachmentPlannerService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listAttachments(planId: string, caseId: string, orgId: string) {
    await this.verifyOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT * FROM treatment_attachments WHERE treatment_plan_id = $1 ORDER BY fdi_number`,
      [planId],
    );
    return rows.map(this.format);
  }

  async addAttachment(planId: string, caseId: string, orgId: string, dto: CreateAttachmentDto, userId: string) {
    await this.verifyOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO treatment_attachments
         (case_id, treatment_plan_id, fdi_number, attachment_type,
          width_mm, height_mm, depth_mm, surface,
          activation_stage, deactivation_stage, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (treatment_plan_id, fdi_number, attachment_type)
       DO UPDATE SET width_mm = EXCLUDED.width_mm,
                     height_mm = EXCLUDED.height_mm,
                     depth_mm = EXCLUDED.depth_mm,
                     surface = EXCLUDED.surface,
                     activation_stage = EXCLUDED.activation_stage,
                     deactivation_stage = EXCLUDED.deactivation_stage,
                     notes = EXCLUDED.notes,
                     updated_at = now()
       RETURNING *`,
      [
        caseId, planId, dto.fdiNumber, dto.attachmentType,
        dto.widthMm ?? 3.0, dto.heightMm ?? 2.0, dto.depthMm ?? 0.5,
        dto.surface ?? 'buccal',
        dto.activationStage ?? 1, dto.deactivationStage ?? null,
        dto.notes ?? null, userId,
      ],
    );
    return this.format(rows[0]);
  }

  async deleteAttachment(attachmentId: string, planId: string, caseId: string, orgId: string) {
    await this.verifyOwnership(caseId, orgId);
    const { rowCount } = await this.pool.query(
      `DELETE FROM treatment_attachments WHERE id = $1 AND treatment_plan_id = $2`,
      [attachmentId, planId],
    );
    if (!rowCount) throw new NotFoundException('Attachment not found');
    return { deleted: true };
  }

  async approveAttachment(attachmentId: string, planId: string, caseId: string, orgId: string, userId: string) {
    await this.verifyOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `UPDATE treatment_attachments
       SET is_approved = true, approved_by = $2, approved_at = now(), updated_at = now()
       WHERE id = $1 AND treatment_plan_id = $3
       RETURNING *`,
      [attachmentId, userId, planId],
    );
    if (!rows[0]) throw new NotFoundException('Attachment not found');
    return this.format(rows[0]);
  }

  async autoRecommend(planId: string, caseId: string, orgId: string, userId: string) {
    await this.verifyOwnership(caseId, orgId);

    // Get final stage movements as proxy for total movement
    const { rows: stages } = await this.pool.query(
      `SELECT movement_data FROM aligner_stages
       WHERE treatment_plan_id = $1
       ORDER BY stage_number DESC LIMIT 1`,
      [planId],
    );
    if (!stages[0]) return { recommended: 0, attachments: [] };

    const totals = stages[0]['movement_data'] as MovementMap;
    const recs = recommendAttachments(totals);

    const results = [];
    for (const rec of recs) {
      const { rows } = await this.pool.query(
        `INSERT INTO treatment_attachments
           (case_id, treatment_plan_id, fdi_number, attachment_type,
            surface, is_auto_recommended, created_by)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         ON CONFLICT (treatment_plan_id, fdi_number, attachment_type) DO NOTHING
         RETURNING *`,
        [caseId, planId, rec.fdi, rec.type, rec.surface, userId],
      );
      if (rows[0]) results.push(this.format(rows[0]));
    }

    this.logger.log(`Auto-recommended ${results.length} attachments for plan ${planId}`);
    return { recommended: results.length, attachments: results };
  }

  private async verifyOwnership(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT c.id FROM cases c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1 AND p.organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private format(r: Record<string, unknown>) {
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      planId: r['treatment_plan_id'] as string,
      fdiNumber: r['fdi_number'] as number,
      attachmentType: r['attachment_type'] as string,
      widthMm: r['width_mm'] as number,
      heightMm: r['height_mm'] as number,
      depthMm: r['depth_mm'] as number,
      surface: r['surface'] as string,
      activationStage: r['activation_stage'] as number,
      deactivationStage: r['deactivation_stage'] as number | null,
      isAutoRecommended: r['is_auto_recommended'] as boolean,
      isApproved: r['is_approved'] as boolean,
      approvedAt: r['approved_at'] as Date | null,
      notes: r['notes'] as string | null,
      createdAt: r['created_at'] as Date,
      updatedAt: r['updated_at'] as Date,
    };
  }
}
