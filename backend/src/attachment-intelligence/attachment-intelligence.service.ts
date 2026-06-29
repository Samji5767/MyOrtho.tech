import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttachmentLibraryEntry {
  id: string;
  name: string;
  libraryType: 'standard' | 'precision' | 'retention' | 'custom';
  attachmentType: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  rotationScore: number;
  torqueScore: number;
  extrusionScore: number;
  translationScore: number;
  intrusionScore: number;
  isSystem: boolean;
}

export interface ForceAnalysisResult {
  toothNumber: number;
  attachmentType: string;
  forceVector: { x: number; y: number; z: number };
  momentVector: { x: number; y: number; z: number };
  effectivenessScore: number;
  recommended: boolean;
  collisionRisk: 'none' | 'low' | 'moderate' | 'high';
  manufacturingValid: boolean;
  validationNotes: string | null;
}

export interface AttachmentCollision {
  toothNumber: number;
  adjacentFdi: number;
  overlapMm: number;
  severity: 'warning' | 'critical';
  suggestion: string;
}

export interface ManufacturingValidation {
  totalAttachments: number;
  validCount: number;
  invalidCount: number;
  issues: Array<{ toothNumber: number; issue: string; severity: 'warning' | 'critical' }>;
  printable: boolean;
  minThicknessMm: number;
}

function rowToLibEntry(r: Record<string, unknown>): AttachmentLibraryEntry {
  return {
    id:              r['id'] as string,
    name:            r['name'] as string,
    libraryType:     r['library_type'] as AttachmentLibraryEntry['libraryType'],
    attachmentType:  r['attachment_type'] as string,
    widthMm:         r['width_mm'] as number,
    heightMm:        r['height_mm'] as number,
    depthMm:         r['depth_mm'] as number,
    rotationScore:   r['rotation_score'] as number,
    torqueScore:     r['torque_score'] as number,
    extrusionScore:  r['extrusion_score'] as number,
    translationScore: r['translation_score'] as number,
    intrusionScore:  r['intrusion_score'] as number,
    isSystem:        r['is_system'] as boolean,
  };
}

// Tooth-type adjacency for collision checks
const ADJACENT_PAIRS: [number, number][] = [
  [11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],
  [21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],
  [31,32],[32,33],[33,34],[34,35],[35,36],[36,37],[37,38],
  [41,42],[42,43],[43,44],[44,45],[45,46],[46,47],[47,48],
];

// Select best attachment type given prescription values
function selectBestAttachment(
  library: AttachmentLibraryEntry[],
  prescription: Record<string, unknown>,
): AttachmentLibraryEntry {
  const rotation  = Math.abs(prescription['rotation_deg'] as number ?? 0);
  const torque    = Math.abs(prescription['torque_deg'] as number ?? 0);
  const extrusion = (prescription['extrusion_mm'] as number ?? 0);
  const intrusion = (prescription['intrusion_mm'] as number ?? 0);
  const translation = (
    (prescription['translation_mesial_mm'] as number ?? 0) +
    (prescription['translation_distal_mm'] as number ?? 0) +
    (prescription['translation_buccal_mm'] as number ?? 0) +
    (prescription['translation_lingual_mm'] as number ?? 0)
  );

  // Score each library entry by how well it serves the prescription needs
  let best = library[0];
  let bestScore = -1;

  for (const entry of library) {
    const score =
      (rotation  > 3 ? entry.rotationScore    * 2 : entry.rotationScore) +
      (torque    > 3 ? entry.torqueScore       * 2 : entry.torqueScore) +
      (extrusion > 0 ? entry.extrusionScore    * 1.5 : 0) +
      (intrusion > 0 ? entry.intrusionScore    * 1.5 : 0) +
      (translation > 0 ? entry.translationScore : 0);

    if (score > bestScore) { bestScore = score; best = entry; }
  }

  return best;
}

// Compute force vector from attachment geometry and movement prescription
function computeForceVector(
  entry: AttachmentLibraryEntry,
  prescription: Record<string, unknown>,
): { force: { x: number; y: number; z: number }; moment: { x: number; y: number; z: number } } {
  const rotDeg   = Math.abs(prescription['rotation_deg'] as number ?? 0);
  const torqDeg  = Math.abs(prescription['torque_deg'] as number ?? 0);
  const extMm    = (prescription['extrusion_mm'] as number ?? 0);
  const transMm  = (prescription['translation_mesial_mm'] as number ?? 0) +
                   (prescription['translation_distal_mm'] as number ?? 0);

  // Force components scaled by attachment dimensions (mm) and effectiveness
  const fx = transMm  * entry.translationScore * entry.widthMm * 0.5;
  const fy = extMm    * entry.extrusionScore   * entry.heightMm * 0.4;
  const fz = torqDeg  * entry.torqueScore      * entry.depthMm * 0.1;

  const mx = rotDeg   * entry.rotationScore    * entry.widthMm * 0.08;
  const my = torqDeg  * entry.torqueScore      * entry.heightMm * 0.06;
  const mz = transMm  * entry.translationScore * entry.depthMm * 0.05;

  return {
    force:  { x: parseFloat(fx.toFixed(4)), y: parseFloat(fy.toFixed(4)), z: parseFloat(fz.toFixed(4)) },
    moment: { x: parseFloat(mx.toFixed(4)), y: parseFloat(my.toFixed(4)), z: parseFloat(mz.toFixed(4)) },
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AttachmentIntelligenceService {
  private readonly log = new Logger(AttachmentIntelligenceService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  // ── Library ────────────────────────────────────────────────────────────────

  async getLibrary(orgId: string): Promise<AttachmentLibraryEntry[]> {
    const res = await this.db.query(
      `SELECT * FROM attachment_libraries
       WHERE is_system=true OR organization_id=$1
       ORDER BY library_type, name`,
      [orgId],
    );
    return res.rows.map(rowToLibEntry);
  }

  async createCustomAttachment(
    orgId: string,
    dto: Omit<AttachmentLibraryEntry, 'id' | 'isSystem'>,
  ): Promise<AttachmentLibraryEntry> {
    const res = await this.db.query(
      `INSERT INTO attachment_libraries
         (organization_id, name, library_type, attachment_type,
          width_mm, height_mm, depth_mm,
          rotation_score, torque_score, extrusion_score, translation_score, intrusion_score, is_system)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false) RETURNING *`,
      [
        orgId, dto.name, dto.libraryType, dto.attachmentType,
        dto.widthMm, dto.heightMm, dto.depthMm,
        dto.rotationScore, dto.torqueScore, dto.extrusionScore, dto.translationScore, dto.intrusionScore,
      ],
    );
    return rowToLibEntry(res.rows[0]);
  }

  // ── Optimizer ──────────────────────────────────────────────────────────────

  async optimizeAttachments(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
  ): Promise<ForceAnalysisResult[]> {
    await this.verifyPlan(planId, caseId, orgId);

    const library = await this.getLibrary(orgId);
    const prescRes = await this.db.query(
      `SELECT * FROM movement_prescriptions WHERE plan_id=$1`,
      [planId],
    );

    if (prescRes.rowCount === 0) {
      throw new NotFoundException('No movement prescriptions found — add prescriptions first');
    }

    const results: ForceAnalysisResult[] = [];
    const prescByFdi = new Map<number, Record<string, unknown>>(
      prescRes.rows.map(r => [r['tooth_number'] as number, r]),
    );

    for (const [fdi, presc] of prescByFdi) {
      const best = selectBestAttachment(library, presc);
      const { force, moment } = computeForceVector(best, presc);

      const effectivenessScore = parseFloat(
        ((best.rotationScore + best.torqueScore + best.extrusionScore + best.translationScore) / 4).toFixed(3),
      );

      // Manufacturing validation: depth >= 0.3mm, width >= 1.0mm
      const manufacturingValid = best.depthMm >= 0.3 && best.widthMm >= 1.0;
      const validationNotes = manufacturingValid
        ? null
        : `Attachment dimensions below minimum printable size (depth: ${best.depthMm}mm, width: ${best.widthMm}mm)`;

      await this.db.query(
        `INSERT INTO attachment_force_analysis
           (plan_id, tooth_number, attachment_type, force_vector, moment_vector,
            effectiveness_score, recommended, collision_risk, manufacturing_valid, validation_notes)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9)
         ON CONFLICT (plan_id, tooth_number, attachment_type) DO UPDATE SET
           force_vector=EXCLUDED.force_vector, moment_vector=EXCLUDED.moment_vector,
           effectiveness_score=EXCLUDED.effectiveness_score, recommended=true,
           collision_risk=EXCLUDED.collision_risk,
           manufacturing_valid=EXCLUDED.manufacturing_valid,
           validation_notes=EXCLUDED.validation_notes,
           analyzed_at=now()`,
        [
          planId, fdi, best.attachmentType,
          JSON.stringify(force), JSON.stringify(moment),
          effectivenessScore, 'none', manufacturingValid, validationNotes,
        ],
      );

      results.push({
        toothNumber: fdi,
        attachmentType: best.attachmentType,
        forceVector: force,
        momentVector: moment,
        effectivenessScore,
        recommended: true,
        collisionRisk: 'none',
        manufacturingValid,
        validationNotes,
      });
    }

    // Detect collisions and update risk levels
    const collisions = await this.detectCollisions(planId, prescByFdi);
    for (const c of collisions) {
      const result = results.find(r => r.toothNumber === c.toothNumber);
      if (result) result.collisionRisk = c.severity === 'critical' ? 'high' : 'moderate';
    }

    this.log.log(`Phase 28 optimize: plan ${planId} — ${results.length} attachments analyzed`);
    return results;
  }

  async getForceAnalysis(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<ForceAnalysisResult[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM attachment_force_analysis WHERE plan_id=$1 AND recommended=true ORDER BY tooth_number`,
      [planId],
    );
    return res.rows.map(r => ({
      toothNumber:        r['tooth_number'] as number,
      attachmentType:     r['attachment_type'] as string,
      forceVector:        r['force_vector'] as { x: number; y: number; z: number },
      momentVector:       r['moment_vector'] as { x: number; y: number; z: number },
      effectivenessScore: r['effectiveness_score'] as number,
      recommended:        r['recommended'] as boolean,
      collisionRisk:      r['collision_risk'] as ForceAnalysisResult['collisionRisk'],
      manufacturingValid: r['manufacturing_valid'] as boolean,
      validationNotes:    r['validation_notes'] as string | null,
    }));
  }

  async getCollisions(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<AttachmentCollision[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM attachment_collisions WHERE plan_id=$1 ORDER BY severity DESC, tooth_number`,
      [planId],
    );
    return res.rows.map(r => ({
      toothNumber: r['tooth_number'] as number,
      adjacentFdi: r['adjacent_fdi'] as number,
      overlapMm:   r['overlap_mm'] as number,
      severity:    r['severity'] as 'warning' | 'critical',
      suggestion:  r['suggestion'] as string,
    }));
  }

  async validateManufacturing(
    caseId: string,
    orgId: string,
    planId: string,
  ): Promise<ManufacturingValidation> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM attachment_force_analysis WHERE plan_id=$1`,
      [planId],
    );

    const issues: ManufacturingValidation['issues'] = [];
    let validCount = 0;
    let minThickness = Infinity;

    for (const r of res.rows) {
      const valid = r['manufacturing_valid'] as boolean;
      if (valid) {
        validCount++;
      } else {
        issues.push({
          toothNumber: r['tooth_number'] as number,
          issue: r['validation_notes'] as string ?? 'Unknown manufacturing issue',
          severity: 'critical',
        });
      }

      // Estimate thickness from depth (stored in library, proxied here)
      const depth = 0.5; // default; real system would join to library
      minThickness = Math.min(minThickness, depth);
    }

    // Collision issues as manufacturing warnings
    const collisionRes = await this.db.query(
      `SELECT * FROM attachment_collisions WHERE plan_id=$1`,
      [planId],
    );
    for (const c of collisionRes.rows) {
      issues.push({
        toothNumber: c['tooth_number'] as number,
        issue: `Collision with FDI ${c['adjacent_fdi']}: ${(c['overlap_mm'] as number).toFixed(2)}mm overlap — ${c['suggestion']}`,
        severity: c['severity'] as 'warning' | 'critical',
      });
    }

    return {
      totalAttachments: res.rowCount ?? 0,
      validCount,
      invalidCount: (res.rowCount ?? 0) - validCount,
      issues,
      printable: issues.filter(i => i.severity === 'critical').length === 0,
      minThicknessMm: minThickness === Infinity ? 0.5 : minThickness,
    };
  }

  // ── Collision detection ────────────────────────────────────────────────────

  private async detectCollisions(
    planId: string,
    prescByFdi: Map<number, Record<string, unknown>>,
  ): Promise<AttachmentCollision[]> {
    const collisions: AttachmentCollision[] = [];

    for (const [a, b] of ADJACENT_PAIRS) {
      if (!prescByFdi.has(a) || !prescByFdi.has(b)) continue;

      const pA = prescByFdi.get(a)!;
      const pB = prescByFdi.get(b)!;

      // Proxy: large opposing movements increase attachment collision risk
      const mesialA  = (pA['translation_mesial_mm']  as number ?? 0);
      const distalB  = (pB['translation_distal_mm']  as number ?? 0);
      const conflictMm = mesialA + distalB;

      if (conflictMm > 0.35) {
        const severity = conflictMm > 0.60 ? 'critical' : 'warning';
        const collision: AttachmentCollision = {
          toothNumber: a,
          adjacentFdi: b,
          overlapMm:   parseFloat(conflictMm.toFixed(3)),
          severity,
          suggestion: severity === 'critical'
            ? 'Reduce attachment width or stage movements sequentially'
            : 'Monitor for interproximal clearance at delivery',
        };
        collisions.push(collision);

        await this.db.query(
          `INSERT INTO attachment_collisions
             (plan_id, tooth_number, adjacent_fdi, overlap_mm, severity, suggestion)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (plan_id, tooth_number, adjacent_fdi) DO UPDATE SET
             overlap_mm=EXCLUDED.overlap_mm, severity=EXCLUDED.severity, suggestion=EXCLUDED.suggestion`,
          [planId, a, b, collision.overlapMm, collision.severity, collision.suggestion],
        );
      }
    }

    return collisions;
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  private async verifyPlan(planId: string, caseId: string, orgId: string): Promise<void> {
    const res = await this.db.query(
      `SELECT tp.id FROM treatment_plans tp JOIN cases c ON c.id=tp.case_id
       WHERE tp.id=$1 AND tp.case_id=$2 AND c.organization_id=$3`,
      [planId, caseId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Treatment plan not found');
  }
}
