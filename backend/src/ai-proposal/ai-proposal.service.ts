import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface GenerateProposalDto {
  treatmentPlanId?: string;
  angleClassification?: 'I' | 'II_div1' | 'II_div2' | 'III';
  overjetMm?: number;
  overbitemm?: number;
  upperCrowdingMm?: number;
  lowerCrowdingMm?: number;
  boltonOverall?: number;
  boltonAnterior?: number;
}

export interface ReviewProposalDto {
  status: 'reviewed' | 'accepted' | 'rejected';
  reviewNotes?: string;
}

// Clinical rule engine — generates evidence-based treatment recommendations
function generateRecommendations(dto: GenerateProposalDto) {
  const crowding = ((dto.upperCrowdingMm ?? 0) + (dto.lowerCrowdingMm ?? 0)) / 2;
  const angleClass = dto.angleClassification ?? 'I';
  const overjet = dto.overjetMm ?? 3;
  const overbite = dto.overbitemm ?? 2;

  // Estimated stages based on crowding severity
  let baseStages = 14;
  if (crowding > 6) baseStages = 26;
  else if (crowding > 3) baseStages = 20;
  else if (crowding > 1) baseStages = 16;

  // Class II/III adds stages for AP correction
  if (angleClass === 'II_div1' || angleClass === 'II_div2') baseStages += 6;
  if (angleClass === 'III') baseStages += 4;

  // Refinement probability
  let refinementProb = 0.25;
  if (crowding > 6) refinementProb = 0.55;
  else if (crowding > 3) refinementProb = 0.40;
  if (angleClass !== 'I') refinementProb += 0.15;
  refinementProb = Math.min(0.85, refinementProb);

  // Complexity score
  let complexity = 0.3;
  if (crowding > 6) complexity += 0.3;
  else if (crowding > 3) complexity += 0.2;
  if (angleClass !== 'I') complexity += 0.2;
  if (overjet > 5) complexity += 0.1;
  complexity = Math.min(1.0, complexity);

  // IPR suggestions (upper anteriors if upper crowding present)
  const suggestedIpr: object[] = [];
  if ((dto.upperCrowdingMm ?? 0) > 2) {
    suggestedIpr.push({ toothA: '12', toothB: '11', amountMm: 0.3, stage: 4 });
    suggestedIpr.push({ toothA: '11', toothB: '21', amountMm: 0.2, stage: 4 });
    suggestedIpr.push({ toothA: '21', toothB: '22', amountMm: 0.3, stage: 4 });
  }
  if ((dto.lowerCrowdingMm ?? 0) > 2) {
    suggestedIpr.push({ toothA: '41', toothB: '42', amountMm: 0.25, stage: 5 });
    suggestedIpr.push({ toothA: '31', toothB: '32', amountMm: 0.25, stage: 5 });
  }

  // Attachment suggestions
  const suggestedAttachments: object[] = [];
  if (crowding > 2) {
    suggestedAttachments.push({ tooth: '13', type: 'rectangular_horizontal', stage: 1 });
    suggestedAttachments.push({ tooth: '23', type: 'rectangular_horizontal', stage: 1 });
    suggestedAttachments.push({ tooth: '43', type: 'rectangular_horizontal', stage: 1 });
    suggestedAttachments.push({ tooth: '33', type: 'rectangular_horizontal', stage: 1 });
  }
  if (Math.abs(overbite - 2) > 1) {
    suggestedAttachments.push({ tooth: '14', type: 'beveled', stage: 2 });
    suggestedAttachments.push({ tooth: '24', type: 'beveled', stage: 2 });
  }

  // Anchorage recommendations
  const anchorageRecs: object[] = [];
  if (angleClass === 'II_div1' || angleClass === 'II_div2') {
    anchorageRecs.push({ type: 'Class II elastics', teeth: ['16→43', '26→33'], stage: 3 });
  }
  if (angleClass === 'III') {
    anchorageRecs.push({ type: 'Class III elastics', teeth: ['13→46', '23→36'], stage: 3 });
  }
  if (crowding > 6) {
    anchorageRecs.push({ type: 'TAD anchorage', location: 'Upper buccal shelf', stage: 2 });
  }

  // Expansion recommendations
  const expansionRecs: object[] = [];
  if (dto.boltonAnterior && dto.boltonAnterior < 73.9) {
    expansionRecs.push({ arch: 'upper', type: 'anterior expansion', amountMm: 1.5, stage: 6 });
  }

  // Movement sequence outline
  const movementSequence: object[] = [
    { phase: 1, stages: '1-4',  description: 'Initial leveling and alignment', priority: 'lower arch' },
    { phase: 2, stages: '5-8',  description: 'Space closure and AP correction' },
    { phase: 3, stages: '9-12', description: 'Torque and root paralleling' },
    { phase: 4, stages: `13-${baseStages}`, description: 'Finishing and detailing' },
  ];

  return {
    angleClassification: angleClass,
    estimatedStages: baseStages,
    predictedDurationWeeks: baseStages * 2,
    refinementProbability: Math.round(refinementProb * 1000) / 1000,
    complexityScore: Math.round(complexity * 1000) / 1000,
    suggestedIpr,
    suggestedAttachments,
    anchorageRecs,
    expansionRecs,
    movementSequence,
    idealOcclusion: {
      targetOverjet: 2.0,
      targetOverbite: 2.0,
      targetMidlineDeviation: 0,
      targetAngleClass: 'I',
    },
    aiNotes:
      `AI-generated draft — requires clinician review before acceptance. ` +
      `Based on: ${angleClass} malocclusion, ${crowding.toFixed(1)} mm average crowding, ` +
      `overjet ${overjet} mm, overbite ${overbite} mm. ` +
      `Estimated ${baseStages} stages (${baseStages * 2} weeks). ` +
      (crowding > 6 ? 'Severe crowding — consider extraction or significant IPR. ' : '') +
      `Refinement probability: ${Math.round(refinementProb * 100)}%.`,
  };
}

@Injectable()
export class AiProposalService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async verifyCase(caseId: string, orgId: string) {
    const { rows } = await this.pool.query(
      `SELECT id FROM cases WHERE id = $1 AND organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows.length) throw new NotFoundException('Case not found');
  }

  async list(caseId: string, orgId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT p.*, u.email AS reviewed_by_email
         FROM ai_treatment_proposals p
         LEFT JOIN profiles u ON u.id = p.reviewed_by
         WHERE p.case_id = $1
         ORDER BY p.created_at DESC`,
      [caseId],
    );
    return rows.map(this.format);
  }

  async get(caseId: string, orgId: string, proposalId: string) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT p.*, u.email AS reviewed_by_email
         FROM ai_treatment_proposals p
         LEFT JOIN profiles u ON u.id = p.reviewed_by
         WHERE p.id = $1 AND p.case_id = $2`,
      [proposalId, caseId],
    );
    if (!rows.length) throw new NotFoundException('Proposal not found');
    return this.format(rows[0]);
  }

  async generate(caseId: string, orgId: string, _userId: string, dto: GenerateProposalDto) {
    await this.verifyCase(caseId, orgId);

    // Pull latest clinical analysis to enrich proposal if not provided
    if (!dto.upperCrowdingMm || !dto.boltonOverall) {
      const { rows } = await this.pool.query(
        `SELECT * FROM case_analyses WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      );
      if (rows.length) {
        dto = {
          ...dto,
          upperCrowdingMm: dto.upperCrowdingMm ?? rows[0].upper_crowding_mm,
          lowerCrowdingMm: dto.lowerCrowdingMm ?? rows[0].lower_crowding_mm,
          boltonOverall:   dto.boltonOverall   ?? rows[0].bolton_overall,
          boltonAnterior:  dto.boltonAnterior  ?? rows[0].bolton_anterior,
          angleClassification: (dto.angleClassification ?? rows[0].angle_class) as GenerateProposalDto['angleClassification'],
          overjetMm:  dto.overjetMm  ?? rows[0].overjet_mm,
          overbitemm: dto.overbitemm ?? rows[0].overbite_mm,
        };
      }
    }

    const recs = generateRecommendations(dto);

    const { rows } = await this.pool.query(
      `INSERT INTO ai_treatment_proposals
         (case_id, treatment_plan_id, organization_id, status,
          angle_classification, ideal_occlusion, movement_sequence,
          estimated_stages, suggested_attachments, suggested_ipr,
          anchorage_recs, expansion_recs, predicted_duration_weeks,
          refinement_probability, complexity_score, ai_notes)
         VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
      [
        caseId,
        dto.treatmentPlanId ?? null,
        orgId,
        recs.angleClassification,
        JSON.stringify(recs.idealOcclusion),
        JSON.stringify(recs.movementSequence),
        recs.estimatedStages,
        JSON.stringify(recs.suggestedAttachments),
        JSON.stringify(recs.suggestedIpr),
        JSON.stringify(recs.anchorageRecs),
        JSON.stringify(recs.expansionRecs),
        recs.predictedDurationWeeks,
        recs.refinementProbability,
        recs.complexityScore,
        recs.aiNotes,
      ],
    );
    return this.format(rows[0]);
  }

  async review(caseId: string, orgId: string, userId: string, proposalId: string, dto: ReviewProposalDto) {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.pool.query(
      `UPDATE ai_treatment_proposals
         SET status = $3, reviewed_by = $4, reviewed_at = NOW(), review_notes = $5
         WHERE id = $1 AND case_id = $2
         RETURNING *`,
      [proposalId, caseId, dto.status, userId, dto.reviewNotes ?? null],
    );
    if (!rows.length) throw new NotFoundException('Proposal not found');
    return this.format(rows[0]);
  }

  private format(r: Record<string, unknown>) {
    return {
      id:                    r.id,
      caseId:                r.case_id,
      treatmentPlanId:       r.treatment_plan_id,
      status:                r.status,
      angleClassification:   r.angle_classification,
      idealOcclusion:        r.ideal_occlusion,
      movementSequence:      r.movement_sequence,
      estimatedStages:       r.estimated_stages,
      suggestedAttachments:  r.suggested_attachments,
      suggestedIpr:          r.suggested_ipr,
      anchorageRecs:         r.anchorage_recs,
      expansionRecs:         r.expansion_recs,
      predictedDurationWeeks: r.predicted_duration_weeks,
      refinementProbability: r.refinement_probability,
      complexityScore:       r.complexity_score,
      aiNotes:               r.ai_notes,
      reviewedByEmail:       r.reviewed_by_email,
      reviewedAt:            r.reviewed_at,
      reviewNotes:           r.review_notes,
      generatedAt:           r.generated_at,
      createdAt:             r.created_at,
    };
  }
}
