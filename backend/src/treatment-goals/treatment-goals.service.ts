import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ToothMovementPrediction {
  fdi: number;
  mesialDistal: number;   // mm, positive = mesial
  buccalLingual: number;  // mm, positive = buccal
  intrusionExtrusion: number; // mm, positive = intrusion
  rotation: number;       // degrees, positive = mesial
  torque: number;         // degrees
  rationale: string;
  confidence: number;     // 0-1
}

export interface AttachmentPlanEntry {
  fdi: number;
  attachmentType: string;
  indication: string;
}

export interface IprPlanEntry {
  mesialTooth: number;
  distalTooth: number;
  reductionMm: number;
  stageEstimate: number;
}

export interface TreatmentGoal {
  id: string;
  organizationId: string;
  caseId: string;
  clinicalAnalysisId: string | null;
  idealArchForm: string;
  predictedDurationWeeks: number;
  predictedAlignerCount: number;
  predictedRefinementCount: number;
  totalIprUpperMm: number;
  totalIprLowerMm: number;
  anchorageStrategy: string;
  retentionStrategy: string;
  toothMovements: ToothMovementPrediction[];
  attachmentPlan: AttachmentPlanEntry[];
  iprPlan: IprPlanEntry[];
  confidence: number;
  rationale: string;
  clinicianModified: boolean;
  clinicianNotes: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateGoalsDto {
  caseId: string;
  clinicalAnalysisId?: string;
  crowdingUpper?: number;
  crowdingLower?: number;
  boltonDiscrepancy?: number;
  overjet?: number;
  overbite?: number;
  angleClass?: string;
  archForm?: string;
}

export interface UpdateGoalDto {
  idealArchForm?: string;
  predictedDurationWeeks?: number;
  predictedAlignerCount?: number;
  totalIprUpperMm?: number;
  totalIprLowerMm?: number;
  anchorageStrategy?: string;
  retentionStrategy?: string;
  toothMovements?: unknown[];
  attachmentPlan?: unknown[];
  iprPlan?: unknown[];
  clinicianNotes?: string;
}

// ─── FDI numbering helpers ─────────────────────────────────────────────────────

const UPPER_TEETH = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27];
const LOWER_TEETH = [31, 32, 33, 34, 35, 36, 37, 41, 42, 43, 44, 45, 46, 47];
const ALL_TEETH   = [...UPPER_TEETH, ...LOWER_TEETH];

function isCanine(fdi: number): boolean {
  return [13, 23, 33, 43].includes(fdi);
}

function isPremolar(fdi: number): boolean {
  return [14, 15, 24, 25, 34, 35, 44, 45].includes(fdi);
}

function isMolar(fdi: number): boolean {
  return [16, 17, 26, 27, 36, 37, 46, 47].includes(fdi);
}

function isIncisor(fdi: number): boolean {
  return [11, 12, 21, 22, 31, 32, 41, 42].includes(fdi);
}

function isUpper(fdi: number): boolean {
  return fdi < 30;
}

// ─── AI Goal Generation Algorithm ─────────────────────────────────────────────

function computeAlignerCount(
  crowdingUpper: number,
  crowdingLower: number,
  overjet: number,
): number {
  // Base count
  let count = 24;
  // Crowding contribution: 3 aligners per mm of combined crowding
  count += (crowdingUpper + crowdingLower) * 3;
  // Severe overjet penalty (> 4mm)
  if (overjet > 4) {
    count += (overjet - 4) * 2.5;
  }
  return Math.round(count);
}

function generateToothMovements(
  crowdingUpper: number,
  crowdingLower: number,
  angleClass: string,
  archForm: string,
  overjet: number,
  overbite: number,
): ToothMovementPrediction[] {
  const movements: ToothMovementPrediction[] = [];

  // Distribute crowding relief across teeth
  // Upper arch — primary movers: canines, premolars, incisors
  const upperCrowdPerTooth = crowdingUpper > 0 ? crowdingUpper / 6 : 0; // 6 anterior teeth
  const lowerCrowdPerTooth = crowdingLower > 0 ? crowdingLower / 6 : 0;

  // Class II modifier: upper retraction, lower protraction
  const classIIUpperRetraction = angleClass === 'Class II' ? -0.5 : 0;
  const classIILowerProtraction = angleClass === 'Class II' ? 0.3 : 0;
  // Class III modifier: upper protraction, lower retraction
  const classIIIUpperProtraction = angleClass === 'Class III' ? 0.4 : 0;
  const classIIILowerRetraction  = angleClass === 'Class III' ? -0.4 : 0;

  // Arch expansion: narrow → expand buccally
  const archExpansion = archForm === 'narrow' ? 0.3 : archForm === 'constricted' ? 0.5 : 0;

  for (const fdi of ALL_TEETH) {
    const upper = isUpper(fdi);
    const crowdPerTooth = upper ? upperCrowdPerTooth : lowerCrowdPerTooth;
    const classModMesialDistal = upper
      ? classIIUpperRetraction + classIIIUpperProtraction
      : classIILowerProtraction + classIIILowerRetraction;

    let mesialDistal = 0;
    let buccalLingual = 0;
    let intrusionExtrusion = 0;
    let rotation = 0;
    let torque = 0;
    const rationale: string[] = [];
    let confidence = 0.88;

    if (isIncisor(fdi)) {
      // Incisors: derotation + alignment
      mesialDistal = crowdPerTooth * 0.4 + classModMesialDistal;
      rotation = crowdPerTooth > 0.5 ? (fdi % 2 === 1 ? -8 : 8) : (fdi % 2 === 1 ? -3 : 3);
      torque = overbite > 3 ? -2.5 : 0;  // intrude deep bite
      intrusionExtrusion = overbite > 3 ? 0.8 : 0;
      buccalLingual = archExpansion * 0.5;
      if (crowdPerTooth > 0.5) rationale.push(`Crowding relief ${crowdPerTooth.toFixed(1)} mm`);
      if (overbite > 3) rationale.push('Deep bite intrusion');
      confidence = 0.90;
    } else if (isCanine(fdi)) {
      // Canines: distalization or mesialization, derotation
      mesialDistal = angleClass === 'Class II' ? -1.5 : angleClass === 'Class III' ? 1.2 : -0.5;
      rotation = crowdingUpper > 3 ? (upper ? -12 : 10) : (upper ? -5 : 4);
      buccalLingual = archExpansion;
      torque = 0;
      rationale.push('Canine distalization for arch alignment');
      if (rotation !== 0) rationale.push(`Rotation correction ${Math.abs(rotation)}°`);
      confidence = 0.86;
    } else if (isPremolar(fdi)) {
      // Premolars: expansion, slight rotation
      buccalLingual = archExpansion * 1.2;
      mesialDistal = crowdPerTooth * 0.2;
      rotation = crowdPerTooth > 0.3 ? (fdi % 2 === 1 ? 5 : -5) : 0;
      torque = archExpansion > 0 ? 3 : 0;
      rationale.push('Premolar expansion and derotation');
      confidence = 0.85;
    } else if (isMolar(fdi)) {
      // Molars: anchorage, minimal movement unless significant correction
      mesialDistal = angleClass === 'Class II' ? -0.5 : angleClass === 'Class III' ? 0.5 : 0;
      buccalLingual = archExpansion * 0.8;
      rotation = 0;
      torque = archExpansion > 0 ? 2 : 0;
      rationale.push('Molar anchorage maintenance');
      confidence = 0.82;
    }

    movements.push({
      fdi,
      mesialDistal: parseFloat(mesialDistal.toFixed(2)),
      buccalLingual: parseFloat(buccalLingual.toFixed(2)),
      intrusionExtrusion: parseFloat(intrusionExtrusion.toFixed(2)),
      rotation: parseFloat(rotation.toFixed(1)),
      torque: parseFloat(torque.toFixed(1)),
      rationale: rationale.length > 0 ? rationale.join('; ') : 'Minor positional correction',
      confidence,
    });
  }

  return movements;
}

function generateAttachmentPlan(movements: ToothMovementPrediction[]): AttachmentPlanEntry[] {
  const plan: AttachmentPlanEntry[] = [];
  for (const mv of movements) {
    if (Math.abs(mv.rotation) > 10) {
      plan.push({
        fdi: mv.fdi,
        attachmentType: isCanine(mv.fdi) ? 'Optimized attachment' : 'Rectangular horizontal attachment',
        indication: `Rotation ${mv.rotation.toFixed(1)}° requires attachment for force couple`,
      });
    } else if (Math.abs(mv.torque) > 15) {
      plan.push({
        fdi: mv.fdi,
        attachmentType: 'Beveled rectangular attachment',
        indication: `Torque ${mv.torque.toFixed(1)}° requires attachment for root control`,
      });
    } else if (isMolar(mv.fdi) && Math.abs(mv.mesialDistal) > 0.3) {
      plan.push({
        fdi: mv.fdi,
        attachmentType: 'Power ridge',
        indication: 'Molar distalization support',
      });
    }
  }
  return plan;
}

function generateIprPlan(
  movements: ToothMovementPrediction[],
  totalIprUpper: number,
  totalIprLower: number,
): IprPlanEntry[] {
  const plan: IprPlanEntry[] = [];

  // Distribute IPR across contacts where crowding is being relieved
  const upperContacts: [number, number][] = [
    [17, 16], [16, 15], [15, 14], [14, 13], [13, 12], [12, 11], [11, 21],
    [21, 22], [22, 23], [23, 24], [24, 25], [25, 26], [26, 27],
  ];
  const lowerContacts: [number, number][] = [
    [47, 46], [46, 45], [45, 44], [44, 43], [43, 42], [42, 41], [41, 31],
    [31, 32], [32, 33], [33, 34], [34, 35], [35, 36], [36, 37],
  ];

  // Only add IPR in anterior/premolar region (not molars)
  const anteriorUpperContacts = upperContacts.filter(
    ([a, b]) => !isMolar(a) && !isMolar(b),
  );
  const anteriorLowerContacts = lowerContacts.filter(
    ([a, b]) => !isMolar(a) && !isMolar(b),
  );

  if (totalIprUpper > 0 && anteriorUpperContacts.length > 0) {
    const perContact = totalIprUpper / anteriorUpperContacts.length;
    anteriorUpperContacts.forEach(([mesial, distal], i) => {
      if (perContact >= 0.1) {
        plan.push({
          mesialTooth: mesial,
          distalTooth: distal,
          reductionMm: parseFloat(Math.min(perContact, 0.5).toFixed(2)),
          stageEstimate: Math.floor(i * 3) + 4,
        });
      }
    });
  }

  if (totalIprLower > 0 && anteriorLowerContacts.length > 0) {
    const perContact = totalIprLower / anteriorLowerContacts.length;
    anteriorLowerContacts.forEach(([mesial, distal], i) => {
      if (perContact >= 0.1) {
        plan.push({
          mesialTooth: mesial,
          distalTooth: distal,
          reductionMm: parseFloat(Math.min(perContact, 0.5).toFixed(2)),
          stageEstimate: Math.floor(i * 3) + 4,
        });
      }
    });
  }

  return plan;
}

function computeConfidence(dto: GenerateGoalsDto): number {
  let score = 0.82;
  if (dto.crowdingUpper !== undefined) score += 0.02;
  if (dto.crowdingLower !== undefined) score += 0.02;
  if (dto.overjet !== undefined) score += 0.02;
  if (dto.overbite !== undefined) score += 0.02;
  if (dto.angleClass !== undefined) score += 0.02;
  if (dto.archForm !== undefined) score += 0.01;
  if (dto.clinicalAnalysisId) score += 0.01;
  return Math.min(0.94, parseFloat(score.toFixed(2)));
}

function buildRationale(dto: GenerateGoalsDto, alignerCount: number, iprUpper: number, iprLower: number): string {
  const parts: string[] = [];

  parts.push(`AI-generated treatment plan for ${dto.angleClass ?? 'Class I'} malocclusion.`);

  if ((dto.crowdingUpper ?? 0) > 0 || (dto.crowdingLower ?? 0) > 0) {
    const total = (dto.crowdingUpper ?? 0) + (dto.crowdingLower ?? 0);
    const severity = total < 4 ? 'mild' : total < 8 ? 'moderate' : 'severe';
    parts.push(`The ${severity} crowding (${(dto.crowdingUpper ?? 0).toFixed(1)} mm upper, ${(dto.crowdingLower ?? 0).toFixed(1)} mm lower) will be addressed through a combination of arch expansion, proclination, and interproximal reduction.`);
  }

  if (iprUpper > 0 || iprLower > 0) {
    parts.push(`Total IPR estimated at ${iprUpper.toFixed(1)} mm upper and ${iprLower.toFixed(1)} mm lower, distributed conservatively across multiple contacts to stay within safe limits (≤ 0.5 mm per contact).`);
  }

  if (dto.overjet !== undefined && dto.overjet > 4) {
    parts.push(`Increased overjet of ${dto.overjet.toFixed(1)} mm will require upper incisor retraction and/or lower incisor proclination, contributing additional aligner stages.`);
  }

  if (dto.overbite !== undefined && dto.overbite > 3) {
    parts.push(`Deep overbite of ${dto.overbite.toFixed(1)} mm will be managed through anterior intrusion mechanics, which may require vertical attachments.`);
  }

  parts.push(`Predicted treatment course of ${alignerCount} aligners accommodates staged tooth movements within clinically accepted per-aligner limits. Refinements may be required based on mid-course clinical assessment.`);
  parts.push(`Anchorage will be managed with posterior tooth reinforcement. Full-time retainer wear is prescribed post-treatment to maintain achieved occlusion.`);

  return parts.join(' ');
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): TreatmentGoal {
  return {
    id: r['id'] as string,
    organizationId: r['organization_id'] as string,
    caseId: r['case_id'] as string,
    clinicalAnalysisId: r['clinical_analysis_id'] as string | null,
    idealArchForm: r['ideal_arch_form'] as string,
    predictedDurationWeeks: r['predicted_duration_weeks'] as number,
    predictedAlignerCount: r['predicted_aligner_count'] as number,
    predictedRefinementCount: r['predicted_refinement_count'] as number,
    totalIprUpperMm: parseFloat(r['total_ipr_upper_mm'] as string),
    totalIprLowerMm: parseFloat(r['total_ipr_lower_mm'] as string),
    anchorageStrategy: r['anchorage_strategy'] as string,
    retentionStrategy: r['retention_strategy'] as string,
    toothMovements: (r['tooth_movements'] as ToothMovementPrediction[]) ?? [],
    attachmentPlan: (r['attachment_plan'] as AttachmentPlanEntry[]) ?? [],
    iprPlan: (r['ipr_plan'] as IprPlanEntry[]) ?? [],
    confidence: parseFloat(r['confidence'] as string),
    rationale: r['rationale'] as string,
    clinicianModified: r['clinician_modified'] as boolean,
    clinicianNotes: r['clinician_notes'] as string | null,
    status: r['status'] as string,
    approvedBy: r['approved_by'] as string | null,
    approvedAt: r['approved_at'] as Date | null,
    createdAt: r['created_at'] as Date,
    updatedAt: r['updated_at'] as Date,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TreatmentGoalsService {
  private readonly logger = new Logger(TreatmentGoalsService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async generateGoals(orgId: string, dto: GenerateGoalsDto): Promise<TreatmentGoal> {
    const crowdingUpper = dto.crowdingUpper ?? 0;
    const crowdingLower = dto.crowdingLower ?? 0;
    const overjet       = dto.overjet ?? 2.0;
    const overbite      = dto.overbite ?? 2.0;
    const angleClass    = dto.angleClass ?? 'Class I';
    const archForm      = dto.archForm ?? 'normal';

    // ── Core calculations ──────────────────────────────────────────────────────
    const predictedAlignerCount  = computeAlignerCount(crowdingUpper, crowdingLower, overjet);
    const predictedDurationWeeks = Math.round(predictedAlignerCount * 1.5);
    const predictedRefinementCount = predictedAlignerCount > 30 ? 1 : 0;
    const totalIprUpperMm = parseFloat((Math.max(0, crowdingUpper - 1.0) * 0.5).toFixed(2));
    const totalIprLowerMm = parseFloat((Math.max(0, crowdingLower - 1.0) * 0.5).toFixed(2));

    const totalCrowding = crowdingUpper + crowdingLower;
    const anchorageStrategy =
      totalCrowding < 4
        ? 'Reciprocal anchorage'
        : 'Posterior anchorage reinforcement with auxiliary mechanics as needed';

    const retentionStrategy =
      'Full-time upper and lower Essix retainers for 12 months, then nighttime wear indefinitely';

    const idealArchForm = archForm === 'narrow' || archForm === 'constricted'
      ? 'Tapered-to-ovoid (expanded)'
      : archForm === 'square'
      ? 'Square'
      : 'Ovoid';

    const toothMovements = generateToothMovements(
      crowdingUpper, crowdingLower, angleClass, archForm, overjet, overbite,
    );

    const attachmentPlan = generateAttachmentPlan(toothMovements);
    const iprPlan = generateIprPlan(toothMovements, totalIprUpperMm, totalIprLowerMm);

    const confidence = computeConfidence(dto);
    const rationale  = buildRationale(dto, predictedAlignerCount, totalIprUpperMm, totalIprLowerMm);

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO treatment_goals (
         organization_id, case_id, clinical_analysis_id,
         ideal_arch_form, predicted_duration_weeks, predicted_aligner_count,
         predicted_refinement_count, total_ipr_upper_mm, total_ipr_lower_mm,
         anchorage_strategy, retention_strategy,
         tooth_movements, attachment_plan, ipr_plan,
         confidence, rationale, clinician_modified, status,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6,
         $7, $8, $9,
         $10, $11,
         $12, $13, $14,
         $15, $16, false, 'draft',
         now(), now()
       ) RETURNING *`,
      [
        orgId, dto.caseId, dto.clinicalAnalysisId ?? null,
        idealArchForm, predictedDurationWeeks, predictedAlignerCount,
        predictedRefinementCount, totalIprUpperMm, totalIprLowerMm,
        anchorageStrategy, retentionStrategy,
        JSON.stringify(toothMovements),
        JSON.stringify(attachmentPlan),
        JSON.stringify(iprPlan),
        confidence, rationale,
      ],
    );

    this.logger.log(
      `Generated treatment goal for case ${dto.caseId}: ${predictedAlignerCount} aligners, confidence ${confidence}`,
    );
    return mapRow(rows[0]);
  }

  async listGoals(orgId: string, caseId: string): Promise<TreatmentGoal[]> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM treatment_goals
       WHERE organization_id = $1 AND case_id = $2
       ORDER BY created_at DESC`,
      [orgId, caseId],
    );
    return rows.map(mapRow);
  }

  async getGoal(orgId: string, goalId: string): Promise<TreatmentGoal> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM treatment_goals WHERE id = $1 AND organization_id = $2`,
      [goalId, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Treatment goal ${goalId} not found`);
    return mapRow(rows[0]);
  }

  async updateGoal(orgId: string, goalId: string, dto: UpdateGoalDto): Promise<TreatmentGoal> {
    // Verify ownership
    await this.getGoal(orgId, goalId);

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      sets.push(`${col} = $${idx++}`);
      params.push(val);
    };

    if (dto.idealArchForm !== undefined) addField('ideal_arch_form', dto.idealArchForm);
    if (dto.predictedDurationWeeks !== undefined) addField('predicted_duration_weeks', dto.predictedDurationWeeks);
    if (dto.predictedAlignerCount !== undefined) addField('predicted_aligner_count', dto.predictedAlignerCount);
    if (dto.totalIprUpperMm !== undefined) addField('total_ipr_upper_mm', dto.totalIprUpperMm);
    if (dto.totalIprLowerMm !== undefined) addField('total_ipr_lower_mm', dto.totalIprLowerMm);
    if (dto.anchorageStrategy !== undefined) addField('anchorage_strategy', dto.anchorageStrategy);
    if (dto.retentionStrategy !== undefined) addField('retention_strategy', dto.retentionStrategy);
    if (dto.toothMovements !== undefined) addField('tooth_movements', JSON.stringify(dto.toothMovements));
    if (dto.attachmentPlan !== undefined) addField('attachment_plan', JSON.stringify(dto.attachmentPlan));
    if (dto.iprPlan !== undefined) addField('ipr_plan', JSON.stringify(dto.iprPlan));
    if (dto.clinicianNotes !== undefined) addField('clinician_notes', dto.clinicianNotes);

    if (sets.length === 0) throw new BadRequestException('No fields to update');

    // Mark as clinician-modified if substantive fields changed
    sets.push(`clinician_modified = true`);
    sets.push(`updated_at = now()`);
    params.push(goalId, orgId);

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `UPDATE treatment_goals SET ${sets.join(', ')}
       WHERE id = $${idx++} AND organization_id = $${idx++}
       RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException(`Treatment goal ${goalId} not found`);
    return mapRow(rows[0]);
  }

  async approveGoal(orgId: string, goalId: string, approvedBy: string): Promise<TreatmentGoal> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `UPDATE treatment_goals
       SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [approvedBy, goalId, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Treatment goal ${goalId} not found`);
    this.logger.log(`Treatment goal ${goalId} approved by ${approvedBy}`);
    return mapRow(rows[0]);
  }
}
