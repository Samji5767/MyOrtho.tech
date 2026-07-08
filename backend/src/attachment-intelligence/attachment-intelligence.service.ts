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

export interface AttachmentNecessityScore {
  fdi: number;
  /** 0–100 composite score — higher means attachment is more critically needed. */
  score: number;
  /** True when score ≥ 60 — attachment is clinically required for this movement. */
  isEssential: boolean;
  /** True when 30 ≤ score < 60 — attachment helps but may be omitted with care. */
  canBeOptimized: boolean;
  primaryReason: string;
  contributingFactors: string[];
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

/**
 * Preferred attachment shapes per movement type.
 * Source: Align Technology Clinical Guidelines (2020 edition).
 *
 *  vertical_rectangular  — tipping control (tip ≥ 5° or torque ≥ 5°)
 *  horizontal_rectangular — rotation and bodily translation
 *  beveled_optimized      — extrusion (beveled edge engages the aligner's incisal/occlusal shelf)
 *  composite_button       — anchorage reinforcement
 */
type AttachmentShape =
  | 'vertical_rectangular'
  | 'horizontal_rectangular'
  | 'beveled_optimized'
  | 'composite_button';

function selectAttachmentShape(prescription: Record<string, unknown>): AttachmentShape {
  const rotation  = Math.abs((prescription['rotation_deg']  as number) ?? 0);
  const torque    = Math.abs((prescription['torque_deg']    as number) ?? 0);
  const tipDeg    = Math.abs((prescription['tip_deg']       as number) ?? 0);
  const extrusion = (prescription['extrusion_mm'] as number) ?? 0;
  const isAnchor  = (prescription['is_anchor_unit'] as boolean) ?? false;

  if (isAnchor)    return 'composite_button';
  if (extrusion > 0.5) return 'beveled_optimized';
  if (tipDeg > 5 || torque > 5) return 'vertical_rectangular';
  if (rotation > 5) return 'horizontal_rectangular';
  return 'horizontal_rectangular'; // default for translation
}

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

      // Join to the attachment library to get the actual depth for this attachment
      const libRow = await this.db.query(
        `SELECT depth_mm FROM attachment_library
         WHERE id = $1 LIMIT 1`,
        [r['attachment_library_id']],
      );
      const depth = libRow.rows[0]?.['depth_mm'] as number ?? r['depth_mm'] as number ?? 0.5;
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

  // ── Attachment necessity scoring ───────────────────────────────────────────

  /**
   * Scores how strongly an attachment is needed for a given tooth's movement
   * prescription (0–100). Based on Align Technology clinical guidelines.
   *
   * @param tooth  Movement prescription summary for one tooth.
   */
  scoreAttachmentNecessity(tooth: {
    fdi: number;
    rotationDeg: number;
    torqueDeg: number;
    intrusionMm: number;
    extrusionMm: number;
    translationMm: number;
    /** Number of distinct movement types active simultaneously on this tooth. */
    concurrentMovementCount: number;
  }): AttachmentNecessityScore {
    let score = 0;
    const factors: string[] = [];

    // Rotation — Align guidelines: attachment warranted at ≥15°, critical at ≥35°
    if (tooth.rotationDeg >= 35) {
      score += 35; factors.push(`severe rotation ${tooth.rotationDeg.toFixed(1)}°`);
    } else if (tooth.rotationDeg >= 20) {
      score += 25; factors.push(`significant rotation ${tooth.rotationDeg.toFixed(1)}°`);
    } else if (tooth.rotationDeg >= 10) {
      score += 15; factors.push(`moderate rotation ${tooth.rotationDeg.toFixed(1)}°`);
    }

    // Torque — root torque requires attachment for adequate force couple
    if (tooth.torqueDeg >= 15) {
      score += 30; factors.push(`high torque ${tooth.torqueDeg.toFixed(1)}°`);
    } else if (tooth.torqueDeg >= 10) {
      score += 20; factors.push(`moderate torque ${tooth.torqueDeg.toFixed(1)}°`);
    }

    // Intrusion — biologically demanding; attachment improves grip
    if (tooth.intrusionMm >= 1.0) {
      score += 25; factors.push(`significant intrusion ${tooth.intrusionMm.toFixed(2)}mm`);
    } else if (tooth.intrusionMm >= 0.5) {
      score += 15; factors.push(`intrusion ${tooth.intrusionMm.toFixed(2)}mm`);
    }

    // Extrusion — beveled attachment required for effective extrusion force
    if (tooth.extrusionMm >= 1.5) {
      score += 20; factors.push(`significant extrusion ${tooth.extrusionMm.toFixed(2)}mm`);
    } else if (tooth.extrusionMm >= 0.5) {
      score += 10; factors.push(`extrusion ${tooth.extrusionMm.toFixed(2)}mm`);
    }

    // Translation — large bodily movement needs better force transfer
    if (tooth.translationMm >= 3.0) {
      score += 20; factors.push(`large translation ${tooth.translationMm.toFixed(2)}mm`);
    } else if (tooth.translationMm >= 1.5) {
      score += 10; factors.push(`translation ${tooth.translationMm.toFixed(2)}mm`);
    }

    // Multiple concurrent movements on the same tooth increase attachment need
    if (tooth.concurrentMovementCount >= 3) {
      score += 10; factors.push('3+ concurrent movement types');
    }

    const clampedScore = Math.min(100, score);
    return {
      fdi: tooth.fdi,
      score: clampedScore,
      isEssential:    clampedScore >= 60,
      canBeOptimized: clampedScore >= 30 && clampedScore < 60,
      primaryReason:  factors[0] ?? 'No significant movement demand detected',
      contributingFactors: factors,
    };
  }

  // ── Attachment-level manufacturing constraint validation ───────────────────

  /**
   * Validates an individual attachment geometry against the three clinical
   * manufacturing constraints:
   *   1. Minimum 1.0 mm from gingival margin
   *   2. Maximum 2.5 mm attachment height (aligner shell thickness constraint)
   *   3. Minimum 0.5 mm from contact point
   *
   * A `gingivalMarginDistanceMm` or `contactPointDistanceMm` of undefined is
   * treated as safe (the caller should pass measured values when available).
   */
  private validateManufacturingConstraints(attachment: {
    toothNumber: number;
    heightMm: number;
    depthMm: number;
    widthMm: number;
    gingivalMarginDistanceMm?: number;
    contactPointDistanceMm?: number;
  }): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // 1. Gingival margin distance
    const gingivalDist = attachment.gingivalMarginDistanceMm ?? 1.5;
    if (gingivalDist < 1.0) {
      issues.push(
        `Gingival clearance ${gingivalDist.toFixed(2)}mm < minimum 1.0mm — risk of gingival irritation`,
      );
    }

    // 2. Maximum height (aligner shell can accommodate up to 2.5mm)
    if (attachment.heightMm > 2.5) {
      issues.push(
        `Height ${attachment.heightMm.toFixed(2)}mm exceeds 2.5mm maximum — aligner shell cannot seat`,
      );
    }

    // 3. Contact point clearance
    const contactDist = attachment.contactPointDistanceMm ?? 1.0;
    if (contactDist < 0.5) {
      issues.push(
        `Contact-point clearance ${contactDist.toFixed(2)}mm < minimum 0.5mm — attachment may lock interproximal contacts`,
      );
    }

    // 4. Minimum printable depth
    if (attachment.depthMm < 0.3) {
      issues.push(
        `Depth ${attachment.depthMm.toFixed(2)}mm < minimum printable size 0.3mm`,
      );
    }

    // 5. Minimum printable width
    if (attachment.widthMm < 1.0) {
      issues.push(
        `Width ${attachment.widthMm.toFixed(2)}mm < minimum printable size 1.0mm`,
      );
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Public wrapper around validateManufacturingConstraints — exposes the
   * enhanced geometry checks as a first-class API endpoint helper.
   * The shape selection hint is also returned (Align Technology guidelines).
   */
  validateAttachment(params: {
    toothNumber: number;
    heightMm: number;
    depthMm: number;
    widthMm: number;
    prescription?: Record<string, unknown>;
    gingivalMarginDistanceMm?: number;
    contactPointDistanceMm?: number;
  }): { isValid: boolean; issues: string[]; recommendedShape: AttachmentShape } {
    const { isValid, issues } = this.validateManufacturingConstraints(params);
    const recommendedShape = params.prescription
      ? selectAttachmentShape(params.prescription)
      : 'horizontal_rectangular';
    return { isValid, issues, recommendedShape };
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
