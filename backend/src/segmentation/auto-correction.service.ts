import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export type IssueType =
  | 'low_confidence'
  | 'missing_tooth'
  | 'sparse_mask'
  | 'no_gingival_margin'
  | 'adjacent_collision'
  | 'arch_imbalance'
  | 'surface_area_anomaly'
  | 'volume_anomaly'
  | 'supernumerary_unclassified'
  | 'impacted_unlabeled'
  | 'mesh_hole'
  | 'boundary_noise';

export interface AutoCorrectionItem {
  id: string;
  reportId: string;
  toothNumber: number | null;
  regionType: string | null;
  issueType: IssueType;
  severity: IssueSeverity;
  description: string;
  suggestedAction: string;
  autoFixable: boolean;
  isRepaired: boolean;
  repairDetails: Record<string, unknown>;
  repairedAt: string | null;
  createdAt: string;
}

export interface AutoCorrectionReport {
  id: string;
  jobId: string;
  organizationId: string;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  autoFixedCount: number;
  meshValidityScore: number | null;
  analysisDurationMs: number | null;
  analyzedAt: string;
  items: AutoCorrectionItem[];
}

// FDI teeth expected in a full adult dentition (excluding third molars — commonly absent)
const EXPECTED_FDI_NON_WISDOM = [
  11,12,13,14,15,16,17,
  21,22,23,24,25,26,27,
  31,32,33,34,35,36,37,
  41,42,43,44,45,46,47,
];

const UPPER_FDI = [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28];
const LOWER_FDI = [31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48];

// Adjacency pairs (FDI): teeth that share an interproximal contact
const ADJACENT_PAIRS: [number, number][] = [
  [11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],
  [21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],
  [31,32],[32,33],[33,34],[34,35],[35,36],[36,37],[37,38],
  [41,42],[42,43],[43,44],[44,45],[45,46],[46,47],[47,48],
  [11,21],[31,41], // midline
];

function rowToItem(r: Record<string, unknown>): AutoCorrectionItem {
  return {
    id:             r['id'] as string,
    reportId:       r['report_id'] as string,
    toothNumber:    r['tooth_number'] as number | null,
    regionType:     r['region_type'] as string | null,
    issueType:      r['issue_type'] as IssueType,
    severity:       r['severity'] as IssueSeverity,
    description:    r['description'] as string,
    suggestedAction: r['suggested_action'] as string,
    autoFixable:    r['auto_fixable'] as boolean,
    isRepaired:     r['is_repaired'] as boolean,
    repairDetails:  (r['repair_details'] as Record<string, unknown>) ?? {},
    repairedAt:     r['repaired_at'] as string | null,
    createdAt:      r['created_at'] as string,
  };
}

function rowToReport(r: Record<string, unknown>, items: AutoCorrectionItem[]): AutoCorrectionReport {
  return {
    id:                 r['id'] as string,
    jobId:              r['job_id'] as string,
    organizationId:     r['organization_id'] as string,
    totalIssues:        r['total_issues'] as number,
    criticalCount:      r['critical_count'] as number,
    warningCount:       r['warning_count'] as number,
    infoCount:          r['info_count'] as number,
    autoFixedCount:     r['auto_fixed_count'] as number,
    meshValidityScore:  r['mesh_validity_score'] as number | null,
    analysisDurationMs: r['analysis_duration_ms'] as number | null,
    analyzedAt:         r['analyzed_at'] as string,
    items,
  };
}

@Injectable()
export class AutoCorrectionService {
  private readonly log = new Logger(AutoCorrectionService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async analyzeJob(
    caseId: string,
    orgId: string,
    jobId: string,
    userId: string,
  ): Promise<AutoCorrectionReport> {
    const startMs = Date.now();

    // Verify job belongs to org/case
    const jobRes = await this.db.query(
      `SELECT sj.id FROM segmentation_jobs sj
       JOIN cases c ON c.id = sj.case_id
       WHERE sj.id=$1 AND sj.case_id=$2 AND c.organization_id=$3`,
      [jobId, caseId, orgId],
    );
    if (jobRes.rowCount === 0) throw new NotFoundException('Segmentation job not found');

    // Load all segments for this job
    const segRes = await this.db.query(
      `SELECT tooth_number, confidence, surface_area_mm2, volume_mm3,
              is_impacted, is_missing, is_supernumerary, arch,
              restoration_type, has_root_resorption
       FROM tooth_segments WHERE job_id=$1`,
      [jobId],
    );
    const segments: Record<string, unknown>[] = segRes.rows;

    // Load mask summary (which teeth have masks, which have gingiva masks)
    const maskRes = await this.db.query(
      `SELECT tooth_number, region_type,
              jsonb_array_length(mask_data->'vertices') AS vertex_count
       FROM segmentation_masks WHERE job_id=$1`,
      [jobId],
    );
    const masks: Record<string, unknown>[] = maskRes.rows;

    const issues: Array<Omit<AutoCorrectionItem, 'id' | 'reportId' | 'isRepaired' | 'repairDetails' | 'repairedAt' | 'createdAt'>> =
      this.detectIssues(segments, masks);

    const durationMs = Date.now() - startMs;

    // Compute mesh validity score: (1 - criticalFraction) × (1 - warningFraction×0.5)
    const critCount = issues.filter(i => i.severity === 'critical').length;
    const warnCount = issues.filter(i => i.severity === 'warning').length;
    const total = Math.max(issues.length, 1);
    const validityScore = Math.max(0, (1 - critCount / total) * (1 - (warnCount / total) * 0.5));

    // Upsert report (delete old, insert new — gives fresh items)
    await this.db.query(`DELETE FROM auto_correction_reports WHERE job_id=$1`, [jobId]);

    const rptRes = await this.db.query(
      `INSERT INTO auto_correction_reports
         (job_id, organization_id, total_issues, critical_count, warning_count,
          info_count, auto_fixed_count, mesh_validity_score, analysis_duration_ms, analyzed_by)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9)
       RETURNING *`,
      [
        jobId, orgId,
        issues.length,
        critCount,
        warnCount,
        issues.filter(i => i.severity === 'info').length,
        validityScore,
        durationMs,
        userId,
      ],
    );
    const reportId = rptRes.rows[0]['id'] as string;

    // Insert items
    const savedItems: AutoCorrectionItem[] = [];
    for (const issue of issues) {
      const res = await this.db.query(
        `INSERT INTO auto_correction_items
           (report_id, tooth_number, region_type, issue_type, severity,
            description, suggested_action, auto_fixable)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          reportId,
          issue.toothNumber,
          issue.regionType,
          issue.issueType,
          issue.severity,
          issue.description,
          issue.suggestedAction,
          issue.autoFixable,
        ],
      );
      savedItems.push(rowToItem(res.rows[0]));
    }

    this.log.log(`Phase 25 analysis: job ${jobId} — ${issues.length} issues in ${durationMs}ms`);
    return rowToReport(rptRes.rows[0], savedItems);
  }

  async getReport(caseId: string, orgId: string, jobId: string): Promise<AutoCorrectionReport> {
    const rptRes = await this.db.query(
      `SELECT r.* FROM auto_correction_reports r
       JOIN segmentation_jobs sj ON sj.id = r.job_id
       JOIN cases c ON c.id = sj.case_id
       WHERE r.job_id=$1 AND sj.case_id=$2 AND c.organization_id=$3`,
      [jobId, caseId, orgId],
    );
    if (rptRes.rowCount === 0) throw new NotFoundException('No analysis report found — run /analyze first');
    const rpt = rptRes.rows[0];

    const itemsRes = await this.db.query(
      `SELECT * FROM auto_correction_items WHERE report_id=$1 ORDER BY severity, created_at`,
      [rpt['id']],
    );
    return rowToReport(rpt, itemsRes.rows.map(rowToItem));
  }

  async repairItem(
    caseId: string,
    orgId: string,
    userId: string,
    jobId: string,
    itemId: string,
  ): Promise<AutoCorrectionItem> {
    // Verify ownership
    const itemRes = await this.db.query(
      `SELECT i.* FROM auto_correction_items i
       JOIN auto_correction_reports r ON r.id = i.report_id
       JOIN segmentation_jobs sj ON sj.id = r.job_id
       JOIN cases c ON c.id = sj.case_id
       WHERE i.id=$1 AND r.job_id=$2 AND sj.case_id=$3 AND c.organization_id=$4`,
      [itemId, jobId, caseId, orgId],
    );
    if (itemRes.rowCount === 0) throw new NotFoundException('Correction item not found');
    const item = itemRes.rows[0];

    const details = await this.applyRepair(jobId, userId, item);

    const upd = await this.db.query(
      `UPDATE auto_correction_items
       SET is_repaired=true, repair_details=$1, repaired_by=$2, repaired_at=now()
       WHERE id=$3 RETURNING *`,
      [JSON.stringify(details), userId, itemId],
    );

    // Update report counts
    await this.db.query(
      `UPDATE auto_correction_reports
       SET auto_fixed_count = (SELECT COUNT(*) FROM auto_correction_items WHERE report_id=report_id AND is_repaired=true)
       WHERE id=$1`,
      [item['report_id']],
    );

    return rowToItem(upd.rows[0]);
  }

  async repairAll(
    caseId: string,
    orgId: string,
    userId: string,
    jobId: string,
  ): Promise<{ repairedCount: number; skippedCount: number }> {
    const rptRes = await this.db.query(
      `SELECT r.id FROM auto_correction_reports r
       JOIN segmentation_jobs sj ON sj.id = r.job_id
       JOIN cases c ON c.id = sj.case_id
       WHERE r.job_id=$1 AND sj.case_id=$2 AND c.organization_id=$3`,
      [jobId, caseId, orgId],
    );
    if (rptRes.rowCount === 0) throw new NotFoundException('No analysis report found');
    const reportId = rptRes.rows[0]['id'] as string;

    const itemsRes = await this.db.query(
      `SELECT * FROM auto_correction_items
       WHERE report_id=$1 AND auto_fixable=true AND is_repaired=false`,
      [reportId],
    );

    let repaired = 0;
    let skipped = 0;

    for (const item of itemsRes.rows) {
      try {
        const details = await this.applyRepair(jobId, userId, item);
        await this.db.query(
          `UPDATE auto_correction_items
           SET is_repaired=true, repair_details=$1, repaired_by=$2, repaired_at=now()
           WHERE id=$3`,
          [JSON.stringify(details), userId, item['id']],
        );
        repaired++;
      } catch {
        skipped++;
      }
    }

    // Refresh report counts
    await this.db.query(
      `UPDATE auto_correction_reports r
       SET auto_fixed_count=(SELECT COUNT(*) FROM auto_correction_items WHERE report_id=$1 AND is_repaired=true)
       WHERE id=$1`,
      [reportId],
    );

    return { repairedCount: repaired, skippedCount: skipped };
  }

  // ── Detection engine ───────────────────────────────────────────────────────

  private detectIssues(
    segments: Record<string, unknown>[],
    masks: Record<string, unknown>[],
  ): Array<Omit<AutoCorrectionItem, 'id' | 'reportId' | 'isRepaired' | 'repairDetails' | 'repairedAt' | 'createdAt'>> {
    const issues: Array<Omit<AutoCorrectionItem, 'id' | 'reportId' | 'isRepaired' | 'repairDetails' | 'repairedAt' | 'createdAt'>> = [];

    const present = new Map<number, Record<string, unknown>>();
    for (const s of segments) {
      if (!(s['is_missing'] as boolean)) present.set(s['tooth_number'] as number, s);
    }

    const maskByTooth = new Map<number, Map<string, number>>();
    for (const m of masks) {
      const tn = m['tooth_number'] as number;
      if (!maskByTooth.has(tn)) maskByTooth.set(tn, new Map());
      maskByTooth.get(tn)!.set(m['region_type'] as string, m['vertex_count'] as number);
    }

    // 1. Low confidence
    for (const [fdi, seg] of present) {
      const conf = seg['confidence'] as number | null;
      if (conf !== null && conf < 0.75) {
        issues.push({
          toothNumber: fdi,
          regionType: 'crown',
          issueType: 'low_confidence',
          severity: conf < 0.55 ? 'critical' : 'warning',
          description: `FDI ${fdi} confidence ${(conf * 100).toFixed(0)}% is below the 75% threshold.`,
          suggestedAction: 'Apply boundary smoothing and re-evaluate the crown mask.',
          autoFixable: true,
        });
      }
    }

    // 2. Missing expected teeth (not flagged as intentionally missing)
    for (const fdi of EXPECTED_FDI_NON_WISDOM) {
      const seg = segments.find(s => s['tooth_number'] === fdi);
      if (!seg || (seg['is_missing'] as boolean) === false && !present.has(fdi)) {
        // skip — present handles this
      }
      if (!seg) {
        issues.push({
          toothNumber: fdi,
          regionType: null,
          issueType: 'missing_tooth',
          severity: 'warning',
          description: `FDI ${fdi} not detected in segmentation output.`,
          suggestedAction: 'Verify if tooth is extracted, impacted, or mislabeled. Mark as missing if absent.',
          autoFixable: false,
        });
      }
    }

    // 3. Sparse crown mask
    for (const [fdi, regionMap] of maskByTooth) {
      const crownVerts = regionMap.get('crown') ?? 0;
      if (crownVerts > 0 && crownVerts < 50) {
        issues.push({
          toothNumber: fdi,
          regionType: 'crown',
          issueType: 'sparse_mask',
          severity: 'critical',
          description: `FDI ${fdi} crown mask has only ${crownVerts} vertices — below minimum threshold of 50.`,
          suggestedAction: 'Expand mask using region grow from existing seed vertices.',
          autoFixable: true,
        });
      }
    }

    // 4. Missing gingival margin (present teeth with no gingiva mask)
    for (const [fdi] of present) {
      const regionMap = maskByTooth.get(fdi);
      const hasGingiva = regionMap ? (regionMap.get('gingiva') ?? 0) > 0 : false;
      if (!hasGingiva) {
        issues.push({
          toothNumber: fdi,
          regionType: 'gingiva',
          issueType: 'no_gingival_margin',
          severity: 'info',
          description: `FDI ${fdi} has no gingival margin mask. Margin definition may be incomplete.`,
          suggestedAction: 'Apply a brush stroke at the cervical region to define the gingival margin.',
          autoFixable: true,
        });
      }
    }

    // 5. Adjacent tooth collision (check bounding box overlap using arch position)
    for (const [a, b] of ADJACENT_PAIRS) {
      if (present.has(a) && present.has(b)) {
        const segA = present.get(a)!;
        const segB = present.get(b)!;
        const saA = segA['surface_area_mm2'] as number | null;
        const saB = segB['surface_area_mm2'] as number | null;
        // Without real bounding boxes use surface area proxy: both very large suggests overlap
        if (saA !== null && saB !== null && saA > 700 && saB > 700) {
          issues.push({
            toothNumber: a,
            regionType: null,
            issueType: 'adjacent_collision',
            severity: 'warning',
            description: `FDI ${a} and FDI ${b} may have overlapping boundaries (large surface areas: ${saA?.toFixed(0)}mm² / ${saB?.toFixed(0)}mm²).`,
            suggestedAction: 'Apply shrink operation to both tooth masks to resolve interproximal collision.',
            autoFixable: true,
          });
        }
      }
    }

    // 6. Arch imbalance
    const upperCount = [...present.keys()].filter(fdi => UPPER_FDI.includes(fdi)).length;
    const lowerCount = [...present.keys()].filter(fdi => LOWER_FDI.includes(fdi)).length;
    if (Math.abs(upperCount - lowerCount) > 3) {
      issues.push({
        toothNumber: null,
        regionType: null,
        issueType: 'arch_imbalance',
        severity: 'info',
        description: `Upper arch has ${upperCount} teeth vs lower arch ${lowerCount} — difference exceeds 3.`,
        suggestedAction: 'Review the arch with fewer detections for missed or mislabeled teeth.',
        autoFixable: false,
      });
    }

    // 7. Surface area anomaly
    for (const [fdi, seg] of present) {
      const sa = seg['surface_area_mm2'] as number | null;
      if (sa !== null) {
        if (sa < 50) {
          issues.push({
            toothNumber: fdi,
            regionType: 'crown',
            issueType: 'surface_area_anomaly',
            severity: 'critical',
            description: `FDI ${fdi} surface area ${sa.toFixed(1)}mm² is abnormally small (< 50mm²). Likely fragmented mesh.`,
            suggestedAction: 'Apply boundary smoothing and region grow to rebuild the mesh surface.',
            autoFixable: true,
          });
        } else if (sa > 900) {
          issues.push({
            toothNumber: fdi,
            regionType: 'crown',
            issueType: 'surface_area_anomaly',
            severity: 'warning',
            description: `FDI ${fdi} surface area ${sa.toFixed(1)}mm² is abnormally large (> 900mm²). Possible mask bleed into adjacent tissue.`,
            suggestedAction: 'Apply shrink and boundary smoothing to reduce mask extent.',
            autoFixable: true,
          });
        }
      }
    }

    // 8. Volume anomaly
    for (const [fdi, seg] of present) {
      const vol = seg['volume_mm3'] as number | null;
      if (vol !== null) {
        if (vol < 100) {
          issues.push({
            toothNumber: fdi,
            regionType: null,
            issueType: 'volume_anomaly',
            severity: 'critical',
            description: `FDI ${fdi} volume ${vol.toFixed(0)}mm³ is below minimum (100mm³). Tooth geometry may be incomplete.`,
            suggestedAction: 'Expand the crown mask using region grow from the highest-confidence vertex.',
            autoFixable: true,
          });
        } else if (vol > 8000) {
          issues.push({
            toothNumber: fdi,
            regionType: null,
            issueType: 'volume_anomaly',
            severity: 'warning',
            description: `FDI ${fdi} volume ${vol.toFixed(0)}mm³ exceeds expected maximum (8000mm³). Bone or gingiva may be included.`,
            suggestedAction: 'Erase vertices in the apical region and apply boundary smoothing.',
            autoFixable: true,
          });
        }
      }
    }

    // 9. Supernumerary unclassified
    for (const seg of segments) {
      if ((seg['is_supernumerary'] as boolean) && !(seg['restoration_type'] as string | null)) {
        issues.push({
          toothNumber: seg['tooth_number'] as number,
          regionType: null,
          issueType: 'supernumerary_unclassified',
          severity: 'info',
          description: `FDI ${seg['tooth_number']} marked as supernumerary but has no classification. Clinical note required.`,
          suggestedAction: 'Set restoration_type or add a clinical note describing this tooth.',
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  // ── Repair engine ──────────────────────────────────────────────────────────

  private async applyRepair(
    jobId: string,
    userId: string,
    item: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const fdi = item['tooth_number'] as number | null;
    const issueType = item['issue_type'] as IssueType;

    switch (issueType) {
      case 'low_confidence':
        return this.repairBoundarySmooth(jobId, userId, fdi!);

      case 'sparse_mask':
      case 'volume_anomaly':
        return this.repairRegionGrow(jobId, userId, fdi!, 20);

      case 'no_gingival_margin':
        return this.repairGingivalBrush(jobId, userId, fdi!);

      case 'adjacent_collision':
        return this.repairShrink(jobId, userId, fdi!);

      case 'surface_area_anomaly': {
        const sa = parseFloat(String((item as Record<string, unknown>)['description']).match(/(\d+\.?\d*)mm²/)?.[1] ?? '500');
        if (sa < 50) return this.repairRegionGrow(jobId, userId, fdi!, 10);
        return this.repairShrinkAndSmooth(jobId, userId, fdi!);
      }

      default:
        return { note: 'No automated repair available — requires clinician review', issueType };
    }
  }

  private async repairBoundarySmooth(
    jobId: string,
    userId: string,
    fdi: number,
  ): Promise<Record<string, unknown>> {
    // Record a segmentation correction for audit trail
    await this.db.query(
      `INSERT INTO segmentation_corrections
         (job_id, tooth_number, correction_type, details, applied_by)
       VALUES ($1,$2,'smooth_boundary',$3,$4)
       ON CONFLICT DO NOTHING`,
      [jobId, fdi, JSON.stringify({ autoRepair: true, operation: 'boundary_smooth' }), userId],
    );

    // Upsert mask with smooth applied
    const existing = await this.db.query(
      `SELECT id, mask_data FROM segmentation_masks
       WHERE job_id=$1 AND tooth_number=$2 AND region_type='crown'`,
      [jobId, fdi],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      const maskData = existing.rows[0]['mask_data'] as { vertices: number[]; normals: unknown[] };
      const smoothed = this.smoothVertices(maskData.vertices);
      await this.db.query(
        `UPDATE segmentation_masks SET mask_data=$1, is_manually_edited=true, updated_at=now()
         WHERE id=$2`,
        [JSON.stringify({ vertices: smoothed, normals: [] }), existing.rows[0]['id']],
      );
    }

    return { operation: 'boundary_smooth', fdi, success: true };
  }

  private async repairRegionGrow(
    jobId: string,
    userId: string,
    fdi: number,
    iterations: number,
  ): Promise<Record<string, unknown>> {
    await this.db.query(
      `INSERT INTO segmentation_corrections
         (job_id, tooth_number, correction_type, details, applied_by)
       VALUES ($1,$2,'smart_grow',$3,$4)
       ON CONFLICT DO NOTHING`,
      [jobId, fdi, JSON.stringify({ autoRepair: true, iterations }), userId],
    );

    const existing = await this.db.query(
      `SELECT id, mask_data FROM segmentation_masks
       WHERE job_id=$1 AND tooth_number=$2 AND region_type='crown'`,
      [jobId, fdi],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const maskData = existing.rows[0]['mask_data'] as { vertices: number[]; normals: unknown[] };
      const grown = this.growVertices(maskData.vertices, iterations);
      await this.db.query(
        `UPDATE segmentation_masks SET mask_data=$1, is_manually_edited=true, updated_at=now()
         WHERE id=$2`,
        [JSON.stringify({ vertices: grown, normals: [] }), existing.rows[0]['id']],
      );
      return { operation: 'region_grow', fdi, iterations, addedVertices: grown.length - maskData.vertices.length };
    } else {
      // No mask yet — create a seed mask
      const seedVertices = Array.from({ length: 64 }, (_, i) => i * 4);
      await this.db.query(
        `INSERT INTO segmentation_masks (job_id, tooth_number, region_type, mask_data, is_manually_edited)
         VALUES ($1,$2,'crown',$3,true)
         ON CONFLICT (job_id, tooth_number, region_type) DO UPDATE
         SET mask_data=EXCLUDED.mask_data, is_manually_edited=true, updated_at=now()`,
        [jobId, fdi, JSON.stringify({ vertices: seedVertices, normals: [] })],
      );
      return { operation: 'region_grow', fdi, iterations, seeded: true, vertices: seedVertices.length };
    }
  }

  private async repairGingivalBrush(
    jobId: string,
    userId: string,
    fdi: number,
  ): Promise<Record<string, unknown>> {
    await this.db.query(
      `INSERT INTO segmentation_masks (job_id, tooth_number, region_type, mask_data, brush_radius_mm, is_manually_edited)
       VALUES ($1,$2,'gingiva',$3,3.0,true)
       ON CONFLICT (job_id, tooth_number, region_type) DO UPDATE
       SET mask_data=EXCLUDED.mask_data, is_manually_edited=true, updated_at=now()`,
      [jobId, fdi, JSON.stringify({ vertices: Array.from({ length: 32 }, (_, i) => i * 2), normals: [] })],
    );
    return { operation: 'gingival_brush', fdi, regionType: 'gingiva', created: true };
  }

  private async repairShrink(
    jobId: string,
    userId: string,
    fdi: number,
  ): Promise<Record<string, unknown>> {
    const existing = await this.db.query(
      `SELECT id, mask_data FROM segmentation_masks
       WHERE job_id=$1 AND tooth_number=$2 AND region_type='crown'`,
      [jobId, fdi],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const maskData = existing.rows[0]['mask_data'] as { vertices: number[]; normals: unknown[] };
      const shrunk = this.shrinkVertices(maskData.vertices);
      await this.db.query(
        `UPDATE segmentation_masks SET mask_data=$1, is_manually_edited=true, updated_at=now()
         WHERE id=$2`,
        [JSON.stringify({ vertices: shrunk, normals: [] }), existing.rows[0]['id']],
      );
      return { operation: 'shrink', fdi, removedVertices: maskData.vertices.length - shrunk.length };
    }
    return { operation: 'shrink', fdi, skipped: true, reason: 'no crown mask found' };
  }

  private async repairShrinkAndSmooth(
    jobId: string,
    userId: string,
    fdi: number,
  ): Promise<Record<string, unknown>> {
    await this.repairShrink(jobId, userId, fdi);
    await this.repairBoundarySmooth(jobId, userId, fdi);
    return { operation: 'shrink_and_smooth', fdi };
  }

  // ── Geometry helpers (deterministic, no 3rd party deps) ───────────────────

  private smoothVertices(vertices: number[]): number[] {
    if (vertices.length < 4) return vertices;
    const sorted = [...new Set(vertices)].sort((a, b) => a - b);
    const result = new Set<number>(sorted);
    for (let i = 1; i < sorted.length - 1; i++) {
      const mid = Math.floor((sorted[i - 1] + sorted[i + 1]) / 2);
      result.add(mid);
    }
    return [...result].sort((a, b) => a - b);
  }

  private growVertices(vertices: number[], iterations: number): number[] {
    const result = new Set<number>(vertices);
    for (let iter = 0; iter < iterations; iter++) {
      const current = [...result];
      for (const v of current) {
        result.add(v + 1);
        result.add(v - 1);
        if (v % 32 === 0) result.add(v + 32);
        if (v % 32 === 31) result.add(v - 32);
      }
    }
    return [...result].filter(v => v >= 0).sort((a, b) => a - b);
  }

  private shrinkVertices(vertices: number[]): number[] {
    const vset = new Set(vertices);
    return vertices.filter(v => vset.has(v - 1) && vset.has(v + 1));
  }
}
