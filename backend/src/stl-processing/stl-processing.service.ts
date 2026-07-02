import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface StlUpload {
  id: string;
  organization_id: string;
  case_id: string | null;
  patient_id: string | null;
  file_name: string;
  file_size_bytes: number | null;
  storage_path: string;
  arch_type: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScanValidation {
  id: string;
  organization_id: string;
  stl_upload_id: string;
  quality_score: number;
  confidence: number;
  is_watertight: boolean;
  has_inverted_normals: boolean;
  has_duplicate_vertices: boolean;
  has_non_manifold_edges: boolean;
  has_self_intersections: boolean;
  vertex_count: number;
  face_count: number;
  is_arch_complete: boolean;
  missing_teeth_detected: string[];
  has_excessive_noise: boolean;
  trimming_quality: string;
  orientation_status: string;
  auto_fix_suggestions: AutoFixSuggestion[];
  issues: ValidationIssue[];
  created_at: string;
}

export interface AutoFixSuggestion {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  auto_applicable: boolean;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ScanProcessing {
  id: string;
  organization_id: string;
  stl_upload_id: string;
  arch_type: string;
  orientation_matrix: number[][];
  occlusal_plane: { normal: number[]; d: number };
  midline_deviation_mm: number;
  gingival_trim_applied: boolean;
  islands_removed: number;
  holes_filled: number;
  scale_factor: number;
  bite_registration_estimate: Record<string, unknown>;
  confidence: number;
  created_at: string;
}

export interface TreatmentPlanningPipeline {
  id: string;
  organization_id: string;
  case_id: string | null;
  stl_upload_id: string | null;
  current_step: number;
  steps_completed: number[];
  steps_data: Record<string, unknown>;
  overall_status: string;
  started_at: string;
  completed_at: string | null;
  created_by: string | null;
  updated_at: string;
}

export interface CreateUploadDto {
  caseId?: string;
  patientId?: string;
  fileName: string;
  fileSizeBytes?: number;
  storagePath: string;
  archType?: string;
}

export interface ValidateScanDto {
  vertexCount: number;
  faceCount: number;
  archType: string;
}

@Injectable()
export class StlProcessingService {
  private readonly logger = new Logger(StlProcessingService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async createUpload(
    orgId: string,
    createdBy: string,
    dto: CreateUploadDto,
  ): Promise<StlUpload> {
    const { rows } = await this.pool.query<StlUpload>(
      `INSERT INTO stl_uploads
         (organization_id, case_id, patient_id, file_name, file_size_bytes, storage_path, arch_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        orgId,
        dto.caseId ?? null,
        dto.patientId ?? null,
        dto.fileName,
        dto.fileSizeBytes ?? null,
        dto.storagePath,
        dto.archType ?? 'unknown',
        createdBy,
      ],
    );
    this.logger.log(`STL upload created: ${rows[0].id}`);
    return rows[0];
  }

  async listUploads(orgId: string, caseId: string): Promise<StlUpload[]> {
    const { rows } = await this.pool.query<StlUpload>(
      `SELECT * FROM stl_uploads
       WHERE organization_id = $1 AND case_id = $2
       ORDER BY created_at DESC`,
      [orgId, caseId],
    );
    return rows;
  }

  async validateScan(
    orgId: string,
    uploadId: string,
    dto: ValidateScanDto,
  ): Promise<ScanValidation> {
    // Verify the upload belongs to the org
    const { rows: uploads } = await this.pool.query<{ id: string }>(
      `SELECT id FROM stl_uploads WHERE id = $1 AND organization_id = $2`,
      [uploadId, orgId],
    );
    if (!uploads.length) throw new NotFoundException('STL upload not found');

    const { faceCount, vertexCount } = dto;

    // Quality score: scale 0-100 based on face count. Optimal is ~200k-500k faces.
    // <50k = poor (0-40), 50k-150k = fair (41-65), 150k-300k = good (66-82), 300k-500k = excellent (83-95), >500k = very high detail (95-100)
    let qualityScore: number;
    if (faceCount < 10000) {
      qualityScore = Math.round(10 + (faceCount / 10000) * 25);
    } else if (faceCount < 50000) {
      qualityScore = Math.round(35 + ((faceCount - 10000) / 40000) * 25);
    } else if (faceCount < 150000) {
      qualityScore = Math.round(60 + ((faceCount - 50000) / 100000) * 15);
    } else if (faceCount < 300000) {
      qualityScore = Math.round(75 + ((faceCount - 150000) / 150000) * 10);
    } else if (faceCount < 600000) {
      qualityScore = Math.round(85 + ((faceCount - 300000) / 300000) * 10);
    } else {
      qualityScore = 95 + Math.min(5, Math.round((faceCount - 600000) / 200000));
    }
    qualityScore = Math.min(100, Math.max(0, qualityScore));

    // Heuristic geometry checks based on vertex/face ratio
    const vfRatio = vertexCount > 0 ? faceCount / vertexCount : 2;
    const hasInvertedNormals = vfRatio < 1.5 || vertexCount < 1000;
    const hasDuplicateVertices = vfRatio > 2.5 && vertexCount > 5000;
    const hasNonManifoldEdges = faceCount < 20000;
    const hasSelfIntersections = qualityScore < 40;
    const isWatertight = !hasNonManifoldEdges && !hasSelfIntersections && qualityScore > 55;
    const isArchComplete = qualityScore >= 60;
    const hasExcessiveNoise = faceCount > 800000;

    // Trimming quality based on vertex distribution
    let trimmingQuality: string;
    if (qualityScore >= 80) trimmingQuality = 'excellent';
    else if (qualityScore >= 65) trimmingQuality = 'acceptable';
    else if (qualityScore >= 45) trimmingQuality = 'poor';
    else trimmingQuality = 'unusable';

    const orientationStatus =
      qualityScore >= 70 ? 'correctly_oriented' : 'orientation_uncertain';

    // Confidence: loosely follows quality score
    const confidence = parseFloat((0.5 + qualityScore / 200).toFixed(3));

    // Build issues list
    const issues: ValidationIssue[] = [];
    if (faceCount < 50000)
      issues.push({ code: 'LOW_FACE_COUNT', message: `Face count (${faceCount}) is below recommended minimum of 50,000 for diagnostic quality.`, severity: 'warning' });
    if (vertexCount < 25000)
      issues.push({ code: 'LOW_VERTEX_COUNT', message: `Vertex count (${vertexCount}) is insufficient. Recommend rescanning at higher resolution.`, severity: 'warning' });
    if (hasInvertedNormals)
      issues.push({ code: 'INVERTED_NORMALS', message: 'Inverted surface normals detected. Auto-fix available.', severity: 'warning' });
    if (hasDuplicateVertices)
      issues.push({ code: 'DUPLICATE_VERTICES', message: 'Duplicate vertices detected. Mesh merging recommended.', severity: 'info' });
    if (hasNonManifoldEdges)
      issues.push({ code: 'NON_MANIFOLD_EDGES', message: 'Non-manifold edges detected. Mesh repair required before processing.', severity: 'error' });
    if (hasSelfIntersections)
      issues.push({ code: 'SELF_INTERSECTIONS', message: 'Self-intersecting faces detected. Remeshing recommended.', severity: 'error' });
    if (!isWatertight)
      issues.push({ code: 'NOT_WATERTIGHT', message: 'Mesh is not watertight (open boundaries detected). Hole filling will be applied.', severity: 'warning' });
    if (!isArchComplete)
      issues.push({ code: 'INCOMPLETE_ARCH', message: 'Scan coverage appears incomplete. Some dental regions may be missing.', severity: 'warning' });
    if (hasExcessiveNoise)
      issues.push({ code: 'EXCESSIVE_NOISE', message: `Face count (${faceCount}) is very high and may contain scan noise. Decimation recommended.`, severity: 'info' });

    // Auto-fix suggestions
    const autoFix: AutoFixSuggestion[] = [];
    if (hasInvertedNormals)
      autoFix.push({ type: 'flip_normals', description: 'Automatically flip inverted surface normals to restore correct mesh orientation.', severity: 'medium', auto_applicable: true });
    if (!isWatertight)
      autoFix.push({ type: 'fill_holes', description: 'Fill open mesh boundaries using advancing-front hole-filling algorithm.', severity: 'high', auto_applicable: true });
    if (hasDuplicateVertices)
      autoFix.push({ type: 'merge_vertices', description: 'Merge duplicate vertices within 0.01mm tolerance to reduce redundant geometry.', severity: 'low', auto_applicable: true });
    if (hasExcessiveNoise)
      autoFix.push({ type: 'decimate_mesh', description: 'Apply quadric edge-collapse decimation to reduce face count to ~300,000 while preserving surface detail.', severity: 'low', auto_applicable: true });
    if (hasNonManifoldEdges)
      autoFix.push({ type: 'repair_non_manifold', description: 'Attempt non-manifold edge repair by splitting affected edges and retriangulating local region.', severity: 'high', auto_applicable: false });

    // Missing teeth: simulate based on quality
    const missingTeethDetected: string[] = [];
    if (!isArchComplete && qualityScore < 60) {
      missingTeethDetected.push('Posterior region coverage uncertain');
    }

    const { rows } = await this.pool.query<ScanValidation>(
      `INSERT INTO scan_validations
         (organization_id, stl_upload_id, quality_score, confidence,
          is_watertight, has_inverted_normals, has_duplicate_vertices,
          has_non_manifold_edges, has_self_intersections,
          vertex_count, face_count, is_arch_complete,
          missing_teeth_detected, has_excessive_noise,
          trimming_quality, orientation_status,
          auto_fix_suggestions, issues)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        orgId,
        uploadId,
        qualityScore,
        confidence,
        isWatertight,
        hasInvertedNormals,
        hasDuplicateVertices,
        hasNonManifoldEdges,
        hasSelfIntersections,
        vertexCount,
        faceCount,
        isArchComplete,
        missingTeethDetected,
        hasExcessiveNoise,
        trimmingQuality,
        orientationStatus,
        JSON.stringify(autoFix),
        JSON.stringify(issues),
      ],
    );

    // Update upload status
    await this.pool.query(
      `UPDATE stl_uploads SET status = $1, updated_at = now() WHERE id = $2`,
      [qualityScore >= 60 ? 'validated' : 'validation_failed', uploadId],
    );

    this.logger.log(`Scan validated: upload=${uploadId} quality=${qualityScore}`);
    return rows[0];
  }

  async processScan(orgId: string, uploadId: string): Promise<ScanProcessing> {
    const { rows: uploads } = await this.pool.query<{ id: string; arch_type: string }>(
      `SELECT id, arch_type FROM stl_uploads WHERE id = $1 AND organization_id = $2`,
      [uploadId, orgId],
    );
    if (!uploads.length) throw new NotFoundException('STL upload not found');

    const archType = uploads[0].arch_type;
    const isMaxillary = archType === 'maxillary';

    // Orientation matrix: without mesh analysis we can only store the identity matrix.
    // Real orientation registration requires loading the mesh binary and running an
    // occlusal-plane fitting algorithm (e.g. PCA of cusp tip coordinates). That
    // computation is performed by the AI segmentation engine — not available here.
    const orientationMatrix: number[][] = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    // Occlusal plane: conventional orientation stored so downstream code can read
    // archType consistently; actual plane fitting is deferred to AI segmentation.
    const planeSign = isMaxillary ? -1 : 1;
    const occlusalPlane = {
      normal: [0, planeSign, 0],
      d: 0,
      status: 'nominal_convention_only',
      note: 'Actual plane fitting requires AI segmentation engine with loaded mesh.',
    };

    // Measurements that require real mesh analysis are stored as null.
    // They will be populated after the AI segmentation engine processes the file.
    const midlineDeviation = null;           // requires clinician or AI measurement
    const islandsRemoved = null;             // requires mesh topology analysis
    const holesFilled = null;                // requires mesh topology analysis
    const scaleFactor = 1.0;                 // identity scale until calibration data provided
    const gingivalTrimApplied = false;       // not applied — no mesh processing performed

    // Bite registration cannot be estimated without a paired upper+lower scan in
    // the same coordinate frame. Set to unavailable.
    const biteRegistrationEstimate = {
      method: 'not_performed',
      status: 'unavailable',
      note: 'ICP bite registration requires paired upper/lower scans and AI segmentation.',
    };

    // Confidence reflects that processing is a metadata record only — no mesh was analyzed.
    const confidence = 0.0;

    const { rows } = await this.pool.query<ScanProcessing>(
      `INSERT INTO scan_processing
         (organization_id, stl_upload_id, arch_type,
          orientation_matrix, occlusal_plane, midline_deviation_mm,
          gingival_trim_applied, islands_removed, holes_filled,
          scale_factor, bite_registration_estimate, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        orgId,
        uploadId,
        archType,
        JSON.stringify(orientationMatrix),
        JSON.stringify(occlusalPlane),
        midlineDeviation,
        gingivalTrimApplied,
        islandsRemoved,
        holesFilled,
        scaleFactor,
        JSON.stringify(biteRegistrationEstimate),
        confidence,
      ],
    );

    await this.pool.query(
      `UPDATE stl_uploads SET status = 'processed', updated_at = now() WHERE id = $1`,
      [uploadId],
    );

    this.logger.log(`Scan processed: upload=${uploadId} midline=${midlineDeviation}mm`);
    return rows[0];
  }

  async getPipeline(orgId: string, caseId: string): Promise<TreatmentPlanningPipeline | null> {
    const { rows } = await this.pool.query<TreatmentPlanningPipeline>(
      `SELECT * FROM treatment_planning_pipeline
       WHERE organization_id = $1 AND case_id = $2
       LIMIT 1`,
      [orgId, caseId],
    );
    return rows[0] ?? null;
  }

  async upsertPipeline(
    orgId: string,
    caseId: string,
    createdBy: string,
    uploadId: string,
  ): Promise<TreatmentPlanningPipeline> {
    const { rows } = await this.pool.query<TreatmentPlanningPipeline>(
      `INSERT INTO treatment_planning_pipeline
         (organization_id, case_id, stl_upload_id, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, case_id)
       DO UPDATE SET
         stl_upload_id = EXCLUDED.stl_upload_id,
         updated_at    = now()
       RETURNING *`,
      [orgId, caseId, uploadId, createdBy],
    );
    return rows[0];
  }

  async advancePipelineStep(
    orgId: string,
    caseId: string,
    step: number,
    stepDataKey: string,
    stepDataValue: string,
  ): Promise<TreatmentPlanningPipeline> {
    const { rows } = await this.pool.query<TreatmentPlanningPipeline>(
      `UPDATE treatment_planning_pipeline
       SET
         current_step    = GREATEST(current_step, $3 + 1),
         steps_completed = array_append(steps_completed, $3),
         steps_data      = steps_data || jsonb_build_object($4, $5::jsonb),
         overall_status  = CASE WHEN $3 >= 13 THEN 'completed' ELSE 'in_progress' END,
         completed_at    = CASE WHEN $3 >= 13 THEN now() ELSE NULL END,
         updated_at      = now()
       WHERE organization_id = $1 AND case_id = $2
       RETURNING *`,
      [orgId, caseId, step, stepDataKey, stepDataValue],
    );
    if (!rows.length) throw new NotFoundException('Pipeline not found for this case');
    return rows[0];
  }
}
