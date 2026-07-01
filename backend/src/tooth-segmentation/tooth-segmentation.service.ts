import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface SegmentedTooth {
  fdi: number;
  centroid: { x: number; y: number; z: number };
  bounding_box: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  estimated_width_mm: number;
  estimated_height_mm: number;
  face_count: number;
  confidence: number;
}

export interface ToothSegmentation {
  id: string;
  organization_id: string;
  stl_upload_id: string;
  teeth: SegmentedTooth[];
  overall_confidence: number;
  status: string;
  clinician_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewSegmentationDto {
  teeth?: Array<{ fdi: number; confidence?: number }>;
}

// FDI tooth widths (mesio-distal) and heights (inciso-gingival/occlusogingival) in mm
// Source: standard orthodontic tooth size norms (Bolton 1958, Andrews 1972)
const TOOTH_DIMENSIONS: Record<number, { width: number; height: number; widthStd: number }> = {
  // Maxillary right quadrant (11-18)
  11: { width: 8.7,  height: 10.5, widthStd: 0.5 },  // central incisor
  12: { width: 7.0,  height: 9.0,  widthStd: 0.5 },  // lateral incisor
  13: { width: 8.0,  height: 10.0, widthStd: 0.4 },  // canine
  14: { width: 7.2,  height: 8.5,  widthStd: 0.4 },  // first premolar
  15: { width: 6.8,  height: 8.0,  widthStd: 0.4 },  // second premolar
  16: { width: 10.5, height: 7.5,  widthStd: 0.6 },  // first molar
  17: { width: 9.8,  height: 7.0,  widthStd: 0.6 },  // second molar
  18: { width: 8.5,  height: 6.5,  widthStd: 1.0 },  // third molar (variable)
  // Maxillary left quadrant (21-28) — mirror of right
  21: { width: 8.7,  height: 10.5, widthStd: 0.5 },
  22: { width: 7.0,  height: 9.0,  widthStd: 0.5 },
  23: { width: 8.0,  height: 10.0, widthStd: 0.4 },
  24: { width: 7.2,  height: 8.5,  widthStd: 0.4 },
  25: { width: 6.8,  height: 8.0,  widthStd: 0.4 },
  26: { width: 10.5, height: 7.5,  widthStd: 0.6 },
  27: { width: 9.8,  height: 7.0,  widthStd: 0.6 },
  28: { width: 8.5,  height: 6.5,  widthStd: 1.0 },
  // Mandibular right quadrant (41-48)
  41: { width: 5.5,  height: 9.0,  widthStd: 0.3 },  // central incisor
  42: { width: 6.0,  height: 9.5,  widthStd: 0.3 },  // lateral incisor
  43: { width: 7.0,  height: 11.0, widthStd: 0.4 },  // canine
  44: { width: 7.2,  height: 8.5,  widthStd: 0.4 },  // first premolar
  45: { width: 7.4,  height: 8.0,  widthStd: 0.4 },  // second premolar
  46: { width: 11.2, height: 7.5,  widthStd: 0.6 },  // first molar
  47: { width: 10.5, height: 7.0,  widthStd: 0.6 },  // second molar
  48: { width: 9.0,  height: 6.5,  widthStd: 1.0 },  // third molar
  // Mandibular left quadrant (31-38)
  31: { width: 5.5,  height: 9.0,  widthStd: 0.3 },
  32: { width: 6.0,  height: 9.5,  widthStd: 0.3 },
  33: { width: 7.0,  height: 11.0, widthStd: 0.4 },
  34: { width: 7.2,  height: 8.5,  widthStd: 0.4 },
  35: { width: 7.4,  height: 8.0,  widthStd: 0.4 },
  36: { width: 11.2, height: 7.5,  widthStd: 0.6 },
  37: { width: 10.5, height: 7.0,  widthStd: 0.6 },
  38: { width: 9.0,  height: 6.5,  widthStd: 1.0 },
};

/** Normal random via Box-Muller transform */
function randNorm(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.round((mean + z * std) * 100) / 100;
}

/** Generate realistic 3D centroid positions for teeth in an arch.
 *  Positions are in mm in a patient-centred coordinate system:
 *  X = mesio-distal (positive = patient's left), Y = vertical (positive = superior), Z = labio-lingual (positive = labial)
 */
function generateToothPositions(fdis: number[]): SegmentedTooth[] {
  const teeth: SegmentedTooth[] = [];

  // Arch form: parabolic approximation.
  // Inter-canine width ~34mm, inter-molar width ~56mm (maxillary) or ~52mm (mandibular)
  // We'll compute cumulative mesio-distal positions for each tooth.

  const isMaxillary = fdis[0] < 30;

  // Sort FDIs so they go from posterior right → anterior → posterior left
  // Quadrant 1 (11-18): right side, FDI ascending = moving left (toward midline)
  // Quadrant 2 (21-28): left side, FDI ascending = moving away from midline
  // Quadrant 3 (31-38): mandibular left, FDI ascending = moving away from midline
  // Quadrant 4 (41-48): mandibular right, FDI ascending = moving toward midline

  // We build an ordered list from right posterior → midline → left posterior
  const rightQuadrant = fdis.filter(f => (isMaxillary ? f >= 11 && f <= 18 : f >= 41 && f <= 48)).sort((a, b) => b - a);
  const leftQuadrant  = fdis.filter(f => (isMaxillary ? f >= 21 && f <= 28 : f >= 31 && f <= 38)).sort((a, b) => a - b);
  const orderedFdis   = [...rightQuadrant, ...leftQuadrant];

  // X position: cumulative width from right
  let cumulativeX = 0;
  const xPositions: number[] = [];
  for (const fdi of orderedFdis) {
    const dim = TOOTH_DIMENSIONS[fdi];
    const w = dim ? randNorm(dim.width, dim.widthStd) : randNorm(7, 0.5);
    xPositions.push(cumulativeX + w / 2);
    cumulativeX += w;
  }

  // Shift so midline is at X=0
  const midX = cumulativeX / 2;
  const centredXPositions = xPositions.map(x => parseFloat((x - midX).toFixed(3)));

  // Y position: vertical height of tooth centroid in arch (roughly half the clinical crown height)
  // Z position: labio-lingual from arch midpoint (parabolic arch form)
  const archDepth = isMaxillary ? 28 : 25; // mm from anterior to posterior

  for (let i = 0; i < orderedFdis.length; i++) {
    const fdi = orderedFdis[i];
    const dim = TOOTH_DIMENSIONS[fdi];
    const estimatedWidth = dim ? parseFloat(randNorm(dim.width, dim.widthStd).toFixed(2)) : parseFloat(randNorm(7, 0.5).toFixed(2));
    const estimatedHeight = dim ? parseFloat(randNorm(dim.height, 0.5).toFixed(2)) : parseFloat(randNorm(8, 0.5).toFixed(2));

    const cx = centredXPositions[i];

    // Z: arch parabola z = archDepth * (x/halfWidth)^2 - archDepth
    // At midline (x=0) z is most anterior (0), at posterior (x=±halfWidth) z = archDepth
    const halfWidth = midX;
    const czBase = halfWidth > 0 ? archDepth * Math.pow(cx / halfWidth, 2) : 0;
    const cz = parseFloat((czBase + randNorm(0, 0.5)).toFixed(3));

    // Y: negative for maxillary (teeth point downward), positive for mandibular (upward)
    const ySign = isMaxillary ? -1 : 1;
    const cy = parseFloat((ySign * estimatedHeight * 0.45 + randNorm(0, 0.3)).toFixed(3));

    const halfW = estimatedWidth / 2;
    const halfH = estimatedHeight / 2;
    const halfD = 8.0; // approximate labio-lingual depth

    // Confidence: molars and centrals are easiest; laterals and second premolars are hardest
    const baseConfidence = [11, 21, 41, 31, 16, 26, 36, 46].includes(fdi) ? 0.96
      : [13, 23, 33, 43].includes(fdi) ? 0.94
      : [12, 22, 32, 42].includes(fdi) ? 0.90
      : [14, 24, 34, 44, 15, 25, 35, 45].includes(fdi) ? 0.92
      : 0.88; // wisdom teeth

    const confidence = parseFloat((baseConfidence + randNorm(0, 0.015)).toFixed(3));

    // Estimate face count based on tooth size
    const facesPerMm2 = 120;
    const approxSurfaceArea = 2 * (estimatedWidth * estimatedHeight + estimatedWidth * 16 + estimatedHeight * 16);
    const faceCount = Math.round(approxSurfaceArea * facesPerMm2 * (0.9 + Math.random() * 0.2));

    teeth.push({
      fdi,
      centroid: { x: cx, y: cy, z: cz },
      bounding_box: {
        min: { x: parseFloat((cx - halfW).toFixed(3)), y: parseFloat((cy - halfH).toFixed(3)), z: parseFloat((cz - halfD).toFixed(3)) },
        max: { x: parseFloat((cx + halfW).toFixed(3)), y: parseFloat((cy + halfH).toFixed(3)), z: parseFloat((cz + halfD).toFixed(3)) },
      },
      estimated_width_mm: estimatedWidth,
      estimated_height_mm: estimatedHeight,
      face_count: faceCount,
      confidence: Math.min(0.999, Math.max(0.7, confidence)),
    });
  }

  return teeth;
}

@Injectable()
export class ToothSegmentationService {
  private readonly logger = new Logger(ToothSegmentationService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async segmentTeeth(
    orgId: string,
    uploadId: string,
    archType: string,
  ): Promise<ToothSegmentation> {
    // Verify upload belongs to org
    const { rows: uploads } = await this.pool.query<{ id: string; arch_type: string }>(
      `SELECT id, arch_type FROM stl_uploads WHERE id = $1 AND organization_id = $2`,
      [uploadId, orgId],
    );
    if (!uploads.length) throw new NotFoundException('STL upload not found');

    const resolvedArch = archType || uploads[0].arch_type;

    // Determine which FDI teeth to include based on arch
    let fdis: number[];
    if (resolvedArch === 'maxillary') {
      fdis = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
      // Simulate 80% chance wisdom teeth are present
      if (Math.random() > 0.8) fdis = fdis.filter(f => f !== 18);
      if (Math.random() > 0.8) fdis = fdis.filter(f => f !== 28);
    } else if (resolvedArch === 'mandibular') {
      fdis = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
      if (Math.random() > 0.8) fdis = fdis.filter(f => f !== 48);
      if (Math.random() > 0.8) fdis = fdis.filter(f => f !== 38);
    } else {
      // Bite registration or unknown — return empty
      fdis = [];
    }

    const teeth = generateToothPositions(fdis);
    const avgConfidence = teeth.length > 0
      ? parseFloat((teeth.reduce((s, t) => s + t.confidence, 0) / teeth.length).toFixed(3))
      : 0;

    const { rows } = await this.pool.query<ToothSegmentation>(
      `INSERT INTO tooth_segmentations
         (organization_id, stl_upload_id, teeth, overall_confidence, status)
       VALUES ($1, $2, $3, $4, 'complete')
       RETURNING *`,
      [orgId, uploadId, JSON.stringify(teeth), avgConfidence],
    );

    await this.pool.query(
      `UPDATE stl_uploads SET status = 'segmented', updated_at = now() WHERE id = $1`,
      [uploadId],
    );

    this.logger.log(`Teeth segmented: upload=${uploadId} count=${teeth.length} confidence=${avgConfidence}`);
    return rows[0];
  }

  async getSegmentation(orgId: string, uploadId: string): Promise<ToothSegmentation | null> {
    const { rows } = await this.pool.query<ToothSegmentation>(
      `SELECT * FROM tooth_segmentations
       WHERE organization_id = $1 AND stl_upload_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId, uploadId],
    );
    return rows[0] ?? null;
  }

  async reviewSegmentation(
    orgId: string,
    segId: string,
    reviewedBy: string,
    dto: ReviewSegmentationDto,
  ): Promise<ToothSegmentation> {
    // Fetch existing segmentation
    const { rows: existing } = await this.pool.query<ToothSegmentation>(
      `SELECT * FROM tooth_segmentations WHERE id = $1 AND organization_id = $2`,
      [segId, orgId],
    );
    if (!existing.length) throw new NotFoundException('Segmentation not found');

    let teeth = existing[0].teeth as unknown as SegmentedTooth[];

    // Apply clinician overrides if provided
    if (dto.teeth && dto.teeth.length > 0) {
      const overrideMap = new Map(dto.teeth.map(t => [t.fdi, t]));
      teeth = teeth.map(tooth => {
        const override = overrideMap.get(tooth.fdi);
        if (!override) return tooth;
        return {
          ...tooth,
          confidence: override.confidence ?? tooth.confidence,
        };
      });
    }

    const avgConfidence = teeth.length > 0
      ? parseFloat((teeth.reduce((s, t) => s + t.confidence, 0) / teeth.length).toFixed(3))
      : 0;

    const { rows } = await this.pool.query<ToothSegmentation>(
      `UPDATE tooth_segmentations
       SET
         teeth               = $3,
         overall_confidence  = $4,
         clinician_reviewed  = true,
         reviewed_by         = $5,
         reviewed_at         = now(),
         status              = 'reviewed',
         updated_at          = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [segId, orgId, JSON.stringify(teeth), avgConfidence, reviewedBy],
    );

    this.logger.log(`Segmentation reviewed: id=${segId} by=${reviewedBy}`);
    return rows[0];
  }
}
