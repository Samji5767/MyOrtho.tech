import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RetainerType = 'essix_full' | 'essix_partial' | 'hawley' | 'fixed_lingual' | 'vivera' | 'combo';

export interface RetentionProtocol {
  id: string;
  planId: string;
  relapseRiskScore: number | null;
  relapseRiskLevel: 'low' | 'moderate' | 'high' | 'very_high' | null;
  primaryRetainerType: RetainerType;
  lowerRetainerType: string | null;
  totalRetentionMonths: number;
  nightOnlyStartsMonth: number | null;
  riskFactors: RelapseFactor[];
  clinicalNotes: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface WearPhase {
  id: string;
  phaseNum: number;
  startMonth: number;
  endMonth: number;
  wearHoursPerDay: number;
  wearLabel: string;
  clinicalInstruction: string | null;
}

export interface RelapseFactor {
  id: string;
  factorType: string;
  factorWeight: number;
  description: string;
  detectedValue: string | null;
}

// ─── Evidence-based risk weights (literature summary) ────────────────────────
// Sources: Littlewood 2016 Cochrane review, Edman-Wallén 2019, ABO standards

interface FactorSpec {
  factorType: string;
  weight: number;
  description: string;
  thresholdMm?: number;
  thresholdCount?: number;
}

const FACTOR_SPECS: FactorSpec[] = [
  {
    factorType: 'severe_crowding',
    weight: 0.25,
    description: 'Initial crowding >6mm — high relapse risk without long-term retention',
    thresholdMm: 6.0,
  },
  {
    factorType: 'large_expansion',
    weight: 0.22,
    description: 'Arch expansion >4mm — transverse expansion shows highest relapse rates',
    thresholdMm: 4.0,
  },
  {
    factorType: 'rotation_correction',
    weight: 0.18,
    description: 'Multiple tooth rotations corrected — supra-alveolar fibers cause relapse within 12 months',
    thresholdCount: 4,
  },
  {
    factorType: 'class_ii_correction',
    weight: 0.15,
    description: 'Class II sagittal correction — tendency to revert due to muscle memory',
  },
  {
    factorType: 'class_iii_correction',
    weight: 0.15,
    description: 'Class III correction — skeletal growth continuation risk in younger patients',
  },
  {
    factorType: 'open_bite_correction',
    weight: 0.20,
    description: 'Anterior open bite correction — requires long-term fixed or nightly retention',
  },
  {
    factorType: 'deep_bite_correction',
    weight: 0.15,
    description: 'Deep bite correction — extrusion of anteriors subject to relapse',
  },
  {
    factorType: 'midline_shift',
    weight: 0.12,
    description: 'Midline correction >1.5mm — asymmetric force system prone to relapse',
    thresholdMm: 1.5,
  },
  {
    factorType: 'skeletal_discrepancy',
    weight: 0.18,
    description: 'Underlying skeletal discrepancy treated with dental compensation — ongoing skeletal growth risk',
  },
  {
    factorType: 'bolton_discrepancy',
    weight: 0.08,
    description: 'Bolton ratio discrepancy — proportional size mismatch increases occlusal instability',
  },
  {
    factorType: 'young_patient',
    weight: 0.15,
    description: 'Patient under 18 — ongoing dentoalveolar growth after treatment completion',
  },
  {
    factorType: 'compliance_risk',
    weight: 0.10,
    description: 'Compliance concerns noted in treatment record',
  },
];

// Retainer selection matrix — indexed by risk level
const RETAINER_BY_RISK: Record<string, { upper: RetainerType; lower: string }> = {
  low:       { upper: 'essix_full',     lower: 'essix_full' },
  moderate:  { upper: 'vivera',         lower: 'vivera' },
  high:      { upper: 'combo',          lower: 'fixed_lingual' },
  very_high: { upper: 'fixed_lingual',  lower: 'fixed_lingual' },
};

// Wear schedule phases by risk level (months of wear at N hours/day)
const WEAR_PHASES_BY_RISK: Record<string, Array<{ phaseNum: number; startM: number; endM: number; hours: number; label: string; instruction: string }>> = {
  low: [
    { phaseNum: 1, startM: 0, endM: 6,  hours: 22, label: 'Full-time (22h/day)', instruction: 'Wear at all times except eating and brushing.' },
    { phaseNum: 2, startM: 6, endM: 24, hours: 10, label: 'Night-only (10h/day)', instruction: 'Wear every night during sleep.' },
  ],
  moderate: [
    { phaseNum: 1, startM: 0,  endM: 6,  hours: 22, label: 'Full-time (22h/day)', instruction: 'Wear at all times except eating and brushing.' },
    { phaseNum: 2, startM: 6,  endM: 12, hours: 16, label: 'Daytime + night (16h/day)', instruction: 'Wear during evening and overnight.' },
    { phaseNum: 3, startM: 12, endM: 36, hours: 10, label: 'Night-only (10h/day)', instruction: 'Wear every night during sleep.' },
  ],
  high: [
    { phaseNum: 1, startM: 0,  endM: 12, hours: 22, label: 'Full-time (22h/day)', instruction: 'Full-time wear; remove only for eating, brushing, contact sports.' },
    { phaseNum: 2, startM: 12, endM: 24, hours: 16, label: 'Daytime + night (16h/day)', instruction: 'Evening and overnight wear.' },
    { phaseNum: 3, startM: 24, endM: 48, hours: 10, label: 'Night-only (10h/day)', instruction: 'Nightly retention — indefinite strongly recommended.' },
  ],
  very_high: [
    { phaseNum: 1, startM: 0,  endM: 12, hours: 22, label: 'Full-time (22h/day)', instruction: 'Full-time; fixed lingual retainer bonded at end of active treatment.' },
    { phaseNum: 2, startM: 12, endM: 36, hours: 22, label: 'Full-time (22h/day)', instruction: 'Continue full-time wear with fixed lingual wire in place.' },
    { phaseNum: 3, startM: 36, endM: 60, hours: 10, label: 'Night-only (10h/day)', instruction: 'Permanent fixed lingual retainer; supplementary nightly removable recommended.' },
  ],
};

function riskLevel(score: number): 'low' | 'moderate' | 'high' | 'very_high' {
  if (score < 0.25) return 'low';
  if (score < 0.50) return 'moderate';
  if (score < 0.75) return 'high';
  return 'very_high';
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class RetentionService {
  private readonly log = new Logger(RetentionService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async generateProtocol(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
  ): Promise<RetentionProtocol> {
    await this.verifyPlan(planId, caseId, orgId);

    // Load prescriptions for risk scanning
    const prescRes = await this.db.query(
      `SELECT * FROM movement_prescriptions WHERE plan_id=$1`, [planId],
    );
    const prescriptions = prescRes.rows;

    // Load aligner plan for stage count context
    const genRes = await this.db.query(
      `SELECT strategy FROM aligner_generation_plans WHERE plan_id=$1`, [planId],
    );

    // ── Risk factor detection ──────────────────────────────────────────────────

    const detectedFactors: Array<{ spec: FactorSpec; detectedValue: string }> = [];

    // Large expansion
    const totalExpansion = prescriptions.reduce((s, p) => s + (p['expansion_mm'] as number ?? 0), 0);
    if (totalExpansion >= 4.0) {
      const spec = FACTOR_SPECS.find(f => f.factorType === 'large_expansion')!;
      detectedFactors.push({ spec, detectedValue: `${totalExpansion.toFixed(1)}mm total arch expansion` });
    } else if (totalExpansion >= 2.0) {
      detectedFactors.push({
        spec: { ...FACTOR_SPECS.find(f => f.factorType === 'large_expansion')!, weight: 0.10 },
        detectedValue: `${totalExpansion.toFixed(1)}mm expansion`,
      });
    }

    // Rotation corrections
    const significantRotations = prescriptions.filter(p => Math.abs(p['rotation_deg'] as number ?? 0) >= 10);
    if (significantRotations.length >= 4) {
      const spec = FACTOR_SPECS.find(f => f.factorType === 'rotation_correction')!;
      detectedFactors.push({ spec, detectedValue: `${significantRotations.length} teeth with ≥10° rotation` });
    }

    // Intrusion / extrusion (open or deep bite correction)
    const totalIntrusion = prescriptions.filter(p => (p['intrusion_mm'] as number ?? 0) > 0).reduce((s, p) => s + (p['intrusion_mm'] as number), 0);
    const totalExtrusion = prescriptions.filter(p => (p['extrusion_mm'] as number ?? 0) > 0).reduce((s, p) => s + (p['extrusion_mm'] as number), 0);

    if (totalIntrusion > 3.0) {
      const spec = FACTOR_SPECS.find(f => f.factorType === 'deep_bite_correction')!;
      detectedFactors.push({ spec, detectedValue: `${totalIntrusion.toFixed(1)}mm total anterior intrusion` });
    }
    if (totalExtrusion > 2.0) {
      const spec = FACTOR_SPECS.find(f => f.factorType === 'open_bite_correction')!;
      detectedFactors.push({ spec, detectedValue: `${totalExtrusion.toFixed(1)}mm total extrusion` });
    }

    // Midline shift (from simulation if available)
    const simRes = await this.db.query(
      `SELECT sf.midline_deviation_mm FROM simulation_frames sf
       JOIN treatment_simulations ts ON ts.id=sf.simulation_id
       WHERE ts.plan_id=$1 ORDER BY sf.stage_num DESC LIMIT 1`,
      [planId],
    );
    if (simRes.rowCount && simRes.rowCount > 0) {
      const midline = Math.abs(simRes.rows[0]['midline_deviation_mm'] as number ?? 0);
      if (midline >= 1.5) {
        const spec = FACTOR_SPECS.find(f => f.factorType === 'midline_shift')!;
        detectedFactors.push({ spec, detectedValue: `${midline.toFixed(2)}mm midline deviation` });
      }
    }

    // Class II/III from elastic schedule in aligner plan
    const elasticRes = await this.db.query(
      `SELECT elastic_schedule FROM aligner_generation_plans WHERE plan_id=$1`, [planId],
    );
    if (elasticRes.rowCount && elasticRes.rowCount > 0) {
      const schedule = elasticRes.rows[0]['elastic_schedule'] as Array<{ classification: string }> ?? [];
      if (schedule.some(e => e.classification === 'class_ii')) {
        const spec = FACTOR_SPECS.find(f => f.factorType === 'class_ii_correction')!;
        detectedFactors.push({ spec, detectedValue: 'Class II elastic schedule detected' });
      }
      if (schedule.some(e => e.classification === 'class_iii')) {
        const spec = FACTOR_SPECS.find(f => f.factorType === 'class_iii_correction')!;
        detectedFactors.push({ spec, detectedValue: 'Class III elastic schedule detected' });
      }
    }

    // Compute risk score — sum of weights, capped at 1.0
    const rawScore = Math.min(
      detectedFactors.reduce((s, f) => s + f.spec.weight, 0),
      1.0,
    );
    const riskLvl = riskLevel(rawScore);
    const retainerTypes = RETAINER_BY_RISK[riskLvl];
    const wearPhases = WEAR_PHASES_BY_RISK[riskLvl];
    const totalMonths = wearPhases[wearPhases.length - 1].endM;
    const nightOnlyMonth = wearPhases.find(p => p.hours <= 10)?.startM ?? null;

    // Clinical notes
    const notes = [
      `Relapse risk: ${riskLvl.replace('_', ' ')} (score: ${rawScore.toFixed(3)}).`,
      `${detectedFactors.length} risk factor${detectedFactors.length !== 1 ? 's' : ''} identified.`,
      riskLvl === 'very_high'
        ? 'Fixed lingual retainer strongly recommended. Indefinite retention advised.'
        : riskLvl === 'high'
        ? 'Extended retention period recommended. Long-term nightly wear essential.'
        : 'Standard retention protocol recommended.',
    ].join(' ');

    // Upsert protocol
    const protoRes = await this.db.query(
      `INSERT INTO retention_protocols
         (organization_id, plan_id, relapse_risk_score, relapse_risk_level,
          primary_retainer_type, lower_retainer_type, total_retention_months,
          night_only_starts_month, risk_factors, clinical_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (plan_id) DO UPDATE SET
         relapse_risk_score=EXCLUDED.relapse_risk_score,
         relapse_risk_level=EXCLUDED.relapse_risk_level,
         primary_retainer_type=EXCLUDED.primary_retainer_type,
         lower_retainer_type=EXCLUDED.lower_retainer_type,
         total_retention_months=EXCLUDED.total_retention_months,
         night_only_starts_month=EXCLUDED.night_only_starts_month,
         risk_factors=EXCLUDED.risk_factors,
         clinical_notes=EXCLUDED.clinical_notes,
         updated_at=now()
       RETURNING *`,
      [
        orgId, planId,
        parseFloat(rawScore.toFixed(3)), riskLvl,
        retainerTypes.upper, retainerTypes.lower,
        totalMonths, nightOnlyMonth,
        JSON.stringify(detectedFactors.map(f => ({ type: f.spec.factorType, value: f.detectedValue }))),
        notes, userId,
      ],
    );
    const protoId = protoRes.rows[0]['id'] as string;

    // Persist risk factors
    for (const f of detectedFactors) {
      await this.db.query(
        `INSERT INTO retention_relapse_factors
           (protocol_id, organization_id, factor_type, factor_weight, description, detected_value)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (protocol_id, factor_type) DO UPDATE SET
           factor_weight=EXCLUDED.factor_weight,
           description=EXCLUDED.description,
           detected_value=EXCLUDED.detected_value`,
        [protoId, orgId, f.spec.factorType, f.spec.weight, f.spec.description, f.detectedValue],
      );
    }

    // Persist wear schedule phases
    for (const ph of wearPhases) {
      await this.db.query(
        `INSERT INTO retention_wear_schedule
           (protocol_id, organization_id, phase_num, start_month, end_month,
            wear_hours_per_day, wear_label, clinical_instruction)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (protocol_id, phase_num) DO UPDATE SET
           start_month=EXCLUDED.start_month, end_month=EXCLUDED.end_month,
           wear_hours_per_day=EXCLUDED.wear_hours_per_day,
           wear_label=EXCLUDED.wear_label, clinical_instruction=EXCLUDED.clinical_instruction`,
        [protoId, orgId, ph.phaseNum, ph.startM, ph.endM, ph.hours, ph.label, ph.instruction],
      );
    }

    this.log.log(`Phase 33 retention: plan ${planId} — ${riskLvl} (${rawScore.toFixed(3)}), ${totalMonths} months`);

    const factors = await this.getRiskFactors(protoId);
    return this.rowToProtocol(protoRes.rows[0], factors);
  }

  async getProtocol(caseId: string, orgId: string, planId: string): Promise<RetentionProtocol> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM retention_protocols WHERE plan_id=$1`, [planId],
    );
    if (res.rowCount === 0) throw new NotFoundException('No retention protocol found — run /generate first');
    const factors = await this.getRiskFactors(res.rows[0]['id'] as string);
    return this.rowToProtocol(res.rows[0], factors);
  }

  async getWearSchedule(caseId: string, orgId: string, planId: string): Promise<WearPhase[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const proto = await this.db.query(
      `SELECT id FROM retention_protocols WHERE plan_id=$1`, [planId],
    );
    if (proto.rowCount === 0) throw new NotFoundException('No retention protocol found');
    const res = await this.db.query(
      `SELECT * FROM retention_wear_schedule WHERE protocol_id=$1 ORDER BY phase_num`,
      [proto.rows[0]['id']],
    );
    return res.rows.map(r => ({
      id:                  r['id'] as string,
      phaseNum:            r['phase_num'] as number,
      startMonth:          r['start_month'] as number,
      endMonth:            r['end_month'] as number,
      wearHoursPerDay:     r['wear_hours_per_day'] as number,
      wearLabel:           r['wear_label'] as string,
      clinicalInstruction: r['clinical_instruction'] as string | null,
    }));
  }

  async approveProtocol(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
  ): Promise<RetentionProtocol> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `UPDATE retention_protocols SET approved_by=$1, approved_at=now(), updated_at=now()
       WHERE plan_id=$2 AND organization_id=$3 RETURNING *`,
      [userId, planId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Retention protocol not found');
    const factors = await this.getRiskFactors(res.rows[0]['id'] as string);
    return this.rowToProtocol(res.rows[0], factors);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async getRiskFactors(protoId: string): Promise<RelapseFactor[]> {
    const res = await this.db.query(
      `SELECT * FROM retention_relapse_factors WHERE protocol_id=$1 ORDER BY factor_weight DESC`,
      [protoId],
    );
    return res.rows.map(r => ({
      id:             r['id'] as string,
      factorType:     r['factor_type'] as string,
      factorWeight:   r['factor_weight'] as number,
      description:    r['description'] as string,
      detectedValue:  r['detected_value'] as string | null,
    }));
  }

  private rowToProtocol(r: Record<string, unknown>, factors: RelapseFactor[]): RetentionProtocol {
    return {
      id:                   r['id'] as string,
      planId:               r['plan_id'] as string,
      relapseRiskScore:     r['relapse_risk_score'] as number | null,
      relapseRiskLevel:     r['relapse_risk_level'] as RetentionProtocol['relapseRiskLevel'],
      primaryRetainerType:  r['primary_retainer_type'] as RetainerType,
      lowerRetainerType:    r['lower_retainer_type'] as string | null,
      totalRetentionMonths: r['total_retention_months'] as number,
      nightOnlyStartsMonth: r['night_only_starts_month'] as number | null,
      riskFactors:          factors,
      clinicalNotes:        r['clinical_notes'] as string | null,
      approvedAt:           r['approved_at'] as string | null,
      createdAt:            r['created_at'] as string,
    };
  }

  private async verifyPlan(planId: string, caseId: string, orgId: string): Promise<void> {
    const res = await this.db.query(
      `SELECT tp.id FROM treatment_plans tp JOIN cases c ON c.id=tp.case_id
       WHERE tp.id=$1 AND tp.case_id=$2 AND c.organization_id=$3`,
      [planId, caseId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Treatment plan not found');
  }
}
